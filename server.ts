import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import ping from "ping";
import localDevices from "local-devices";
import { promises as dnsPromises } from "dns";
import { promisify } from "util";
import os from "os";
import { exec } from "child_process";
import { randomUUID } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";

const { lookup } = dnsPromises;
const execAsync = promisify(exec);

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

async function loadData(): Promise<{ groups: any[]; devices: any[] }> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { groups: [], devices: [] };
  }
}

async function saveData(groups: any[], devices: any[]) {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify({ groups, devices }, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist data:", err);
  }
}

/**
 * Resolves a hostname to an IP address with retry logic for temporary failures.
 */
async function resolveName(name: string, retries = 2): Promise<string> {
  const cleanName = name.toLowerCase().trim();
  
  // Simple check for IPv4 or IPv6
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanName) || cleanName.includes(':');
  if (isIp) return cleanName;

  // If it's a single word without dots, it might be a local name or missing a TLD
  const candidates = [cleanName];
  if (!cleanName.includes('.')) {
    // For single words, .com is often the intended target if not local
    candidates.unshift(`${cleanName}.com`); 
    candidates.push(`${cleanName}.local`);
    candidates.push(`${cleanName}.lan`);
  }

  let lastError: any;
  
  // 1. Try system lookup for each candidate
  for (const candidate of candidates) {
    for (let i = 0; i <= retries; i++) {
      try {
        const { address } = await lookup(candidate);
        return address;
      } catch (error: any) {
        lastError = error;
        // EAI_AGAIN is a temporary failure, worth retrying
        if (error.code === 'EAI_AGAIN' && i < retries) {
          console.warn(`DNS lookup for ${candidate} failed with EAI_AGAIN, retrying (${i + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); 
          continue;
        }
        break;
      }
    }
  }

  // 2. Final fallback: Try public DNS (Google/Cloudflare) directly for all candidates
  try {
    const dns = await import("dns");
    const resolver = new dns.promises.Resolver();
    // Use multiple reliable public DNS servers
    resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '9.9.9.9']);
    
    for (const candidate of candidates) {
      try {
        // resolve4 is more direct than lookup for the fallback
        const addresses = await resolver.resolve4(candidate);
        if (addresses && addresses.length > 0) {
          console.log(`Resolved ${candidate} via public DNS fallback: ${addresses[0]}`);
          return addresses[0];
        }
      } catch (e) {
        // Try next candidate in fallback
      }
    }
  } catch (e) {
    // Ignore fallback setup errors
  }
  
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Load persisted data (falls back to empty arrays on first run)
  const persisted = await loadData();
  let groups: any[] = persisted.groups;
  let devices_list: any[] = persisted.devices;

  const initializeDefaultGroup = () => {
    if (groups.length === 0) {
      console.log("Initializing default 'General' group");
      groups = [{
        id: 'default-general',
        name: 'General'
      }];
      saveData(groups, devices_list);
    }
  };

  // Initialize on startup
  initializeDefaultGroup();

  // API: Get all groups
  app.get("/api/groups", (req, res) => {
    res.json(groups);
  });

  // API: Add a new group
  app.post("/api/groups", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const newGroup = {
      id: randomUUID(),
      name
    };
    groups.push(newGroup);
    saveData(groups, devices_list);
    res.status(201).json(newGroup);
  });

  // API: Rename a group
  app.patch("/api/groups/:id", (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const group = groups.find(g => g.id === id);
    if (!group) return res.status(404).json({ error: "Group not found" });
    group.name = name;
    saveData(groups, devices_list);
    res.json(group);
  });

  // API: Delete a group
  app.delete("/api/groups/:id", (req, res) => {
    const { id } = req.params;
    
    groups = groups.filter(g => g.id !== id);
    
    // Ensure at least one group exists
    initializeDefaultGroup();
    
    // Reassign devices to the first available group
    const fallbackGroup = groups.length > 0 ? groups[0].id : '';
    devices_list = devices_list.map(h => h.groupId === id ? { ...h, groupId: fallbackGroup } : h);
    saveData(groups, devices_list);
    res.status(204).send();
  });

  // API: Scan network for devices
  app.post("/api/scan", async (req, res) => {
    try {
      console.log("Scanning network...");
      let devices: any[] = [];
      
      try {
        devices = await localDevices();
      } catch (err: any) {
        console.warn("local-devices failed, trying ip neigh fallback...", err.message);
        try {
          const { stdout } = await execAsync("ip neigh show");
          // Parse ip neigh show output: 192.168.1.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE
          const lines = stdout.split('\n');
          devices = lines
            .map(line => {
              const parts = line.split(' ');
              const ip = parts[0];
              const macIndex = parts.indexOf('lladdr');
              if (macIndex !== -1 && parts[macIndex + 1]) {
                const mac = parts[macIndex + 1];
                return { ip, mac, name: `Device-${ip}` };
              }
              return null;
            })
            .filter(d => d !== null);
        } catch (fallbackErr: any) {
          console.warn("Fallback scan also failed, trying ping sweep...", fallbackErr.message);
          
          // Final fallback: Ping sweep of the local subnet
          try {
            const interfaces = os.networkInterfaces();
            const targets: string[] = [];
            
            for (const name of Object.keys(interfaces)) {
              for (const iface of interfaces[name] || []) {
                if (iface.family === 'IPv4' && !iface.internal) {
                  const parts = iface.address.split('.');
                  const base = parts.slice(0, 3).join('.');
                  // Sweep common range .1 to .254
                  for (let i = 1; i < 255; i++) {
                    targets.push(`${base}.${i}`);
                  }
                }
              }
            }

            if (targets.length > 0) {
              console.log(`Starting ping sweep of ${targets.length} addresses...`);
              // Limit concurrency to avoid overwhelming the system
              const batchSize = 25;
              for (let i = 0; i < targets.length; i += batchSize) {
                const batch = targets.slice(i, i + batchSize);
                const results = await Promise.all(
                  batch.map(async (ip) => {
                    const res = await ping.promise.probe(ip, { timeout: 1 });
                    return res.alive ? { ip, mac: 'Unknown', name: `Device-${ip}` } : null;
                  })
                );
                devices.push(...results.filter(d => d !== null));
              }
            }
          } catch (sweepErr: any) {
            console.error("Ping sweep failed:", sweepErr.message);
            return res.status(500).json({ 
              error: "Network scanning is not supported in this environment.",
              details: "All discovery methods (arp, ip neigh, ping sweep) failed. Please add devices manually."
            });
          }
        }
      }

      console.log(`Found ${devices.length} devices.`);
      
      const newDevices: any[] = [];
      devices.forEach(device => {
        // Check if device already exists
        const exists = devices_list.find(h => h.ip === device.ip);
        if (!exists) {
          const newDevice = {
            id: randomUUID(),
            name: device.name || `Device-${device.ip}`,
            ip: device.ip,
            mac: device.mac,
            groupId: groups[0]?.id || '',
            thresholds: { green: 20, yellow: 50, red: 100 }
          };
          devices_list.push(newDevice);
          newDevices.push(newDevice);
        }
      });

      if (newDevices.length > 0) saveData(groups, devices_list);
      res.json({ message: `Scan complete. Found ${devices.length} devices, added ${newDevices.length} new ones.`, newDevices });
    } catch (error: any) {
      console.error("Scan error:", error);
      res.status(500).json({ error: "Failed to scan network", details: error.message });
    }
  });

  // API: Get all devices with their current status
  app.get("/api/status", async (req, res) => {
    let queryTimeout = parseInt(req.query.timeout as string) || 2;
    // Limit timeout to 10 seconds to prevent long-running requests
    queryTimeout = Math.min(Math.max(1, queryTimeout), 10);
    
    try {
      // Limit concurrency to avoid overwhelming the system
      const batchSize = 10;
      const results: any[] = [];
      
      for (let i = 0; i < devices_list.length; i += batchSize) {
        const batch = devices_list.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (device) => {
            const group = groups.find(g => g.id === device.groupId);
            const groupName = group?.name || 'General';

            // Skip ping if IP is missing or clearly invalid
            if (!device.ip || device.ip === 'Unknown') {
              return {
                ...device,
                group: groupName,
                status: 'offline',
                latency: 0,
                lastChecked: new Date(),
              };
            }

            try {
              const pingRes = await ping.promise.probe(device.ip, {
                timeout: queryTimeout,
              });
              const rawLatency = parseFloat(pingRes.time as unknown as string);
              return {
                ...device,
                group: groupName,
                status: pingRes.alive ? 'online' : 'offline',
                latency: pingRes.alive && !isNaN(rawLatency) ? Math.round(rawLatency) : 0,
                lastChecked: new Date(),
              };
            } catch (err) {
              console.error(`Ping failed for ${device.ip}:`, err);
              return {
                ...device,
                group: groupName,
                status: 'offline',
                latency: 0,
                lastChecked: new Date(),
              };
            }
          })
        );
        results.push(...batchResults);
      }
      
      res.json(results);
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ error: "Failed to check devices status" });
    }
  });

  // API: Add a new device
  app.post("/api/devices", async (req, res) => {
    const { name, ip, groupId } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    // Validate groupId if provided
    const targetGroupId = groupId || groups[0]?.id || '';
    if (targetGroupId && !groups.find(g => g.id === targetGroupId)) {
      return res.status(400).json({ error: "Group not found" });
    }
    
    let resolvedIp = ip;
    if (!resolvedIp) {
      try {
        resolvedIp = await resolveName(name);
        console.log(`Resolved ${name} to ${resolvedIp}`);
      } catch (error: any) {
        console.error(`Failed to resolve device name: ${name}`, error);
        let userMessage = `Could not resolve IP for device: ${name}`;
        if (error.code === 'EAI_AGAIN') {
          userMessage = `DNS resolution timed out for "${name}". Please try again or enter the IP address manually.`;
        } else if (error.code === 'ENOTFOUND') {
          userMessage = `The hostname "${name}" could not be found. Please check the spelling or enter the IP address manually.`;
        }
        
        return res.status(400).json({ 
          error: userMessage,
          details: error.message 
        });
      }
    }
    
    const newDevice = {
      id: randomUUID(),
      name,
      ip: resolvedIp,
      groupId: targetGroupId,
      thresholds: { green: 20, yellow: 50, red: 100 }
    };
    devices_list.push(newDevice);
    saveData(groups, devices_list);
    res.status(201).json(newDevice);
  });

  // API: Delete a device
  app.delete("/api/devices/:id", (req, res) => {
    const { id } = req.params;
    devices_list = devices_list.filter(h => h.id !== id);
    saveData(groups, devices_list);
    res.status(204).send();
  });

  // API: Clear all data
  app.post("/api/clear-all", (req, res) => {
    devices_list = [];
    groups = [];
    initializeDefaultGroup();
    saveData(groups, devices_list);
    res.status(200).json({ message: "All data cleared successfully" });
  });

  // API: Update a device
  app.patch("/api/devices/:id", async (req, res) => {
    const { id } = req.params;
    const { name, ip, groupId, thresholds } = req.body;
    const device = devices_list.find(h => h.id === id);
    if (!device) return res.status(404).json({ error: "Device not found" });
    
    if (name) device.name = name;
    if (thresholds) device.thresholds = thresholds;
    
    if (ip !== undefined) {
      let resolvedIp = ip;
      if (!resolvedIp && device.name) {
        try {
          resolvedIp = await resolveName(device.name);
          console.log(`Resolved ${device.name} to ${resolvedIp}`);
        } catch (error: any) {
          console.error(`Failed to resolve device name: ${device.name}`, error);
          let userMessage = `Could not resolve IP for device: ${device.name}`;
          if (error.code === 'EAI_AGAIN') {
            userMessage = `DNS resolution timed out for "${device.name}". Please try again or enter the IP address manually.`;
          } else if (error.code === 'ENOTFOUND') {
            userMessage = `The hostname "${device.name}" could not be found. Please check the spelling or enter the IP address manually.`;
          }
          
          return res.status(400).json({ 
            error: userMessage,
            details: error.message 
          });
        }
      }
      if (resolvedIp) device.ip = resolvedIp;
    }
    
    if (groupId) {
      const groupExists = groups.find(g => g.id === groupId);
      if (!groupExists) return res.status(400).json({ error: "Group not found" });
      device.groupId = groupId;
    }
    
    saveData(groups, devices_list);
    res.json(device);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
