/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity, 
  Plus, 
  Edit2, 
  Trash2, 
  XCircle, 
  Play, 
  StopCircle, 
  LayoutDashboard, 
  List, 
  Settings, 
  Globe, 
  Wifi, 
  Loader2,
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ChevronRight,
  Search,
  Download
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast, Toaster } from 'sonner';
import { cn } from './lib/utils';

// --- Types ---

interface Device {
  id: string;
  name: string;
  ip: string;
  groupId: string;
  group: string;
  status: 'online' | 'offline';
  latency: number;
  lastChecked: string;
  history: { time: string; latency: number }[];
  thresholds?: { green: number; yellow: number; red: number };
}

interface Group {
  id: string;
  name: string;
}

interface GroupWithDevices extends Group {
  devices: Device[];
}

// --- Components ---

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'cyan' | 'green' | 'red';
  subValue?: string;
}

const StatCard = ({ label, value, icon: Icon, color, subValue }: StatCardProps) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    className={cn(
      "relative overflow-hidden bg-card/50 border border-border p-4 rounded-lg flex flex-col justify-between min-w-[180px]",
      "before:absolute before:top-0 before:left-0 before:w-1 before:h-full",
      color === 'cyan' && "before:bg-[var(--neon-cyan)]",
      color === 'green' && "before:bg-[var(--neon-green)]",
      color === 'red' && "before:bg-[var(--neon-red)]",
    )}
  >
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-2">
        <Icon size={12} />
        {label}
      </span>
      {subValue && <span className="text-[10px] font-mono text-muted-foreground">{subValue}</span>}
    </div>
    <div className={cn(
      "text-3xl font-bold font-mono neon-text",
      color === 'cyan' && "text-[var(--neon-cyan)]",
      color === 'green' && "text-[var(--neon-green)]",
      color === 'red' && "text-[var(--neon-red)]",
    )}>
      {value}
    </div>
  </motion.div>
);

const DeviceCard = ({ 
  device, 
  onClick,
  onEdit, 
  onDelete, 
  onThresholds,
  isSelected
}: { 
  device: Device; 
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void; 
  onDelete: (id: string) => void; 
  onThresholds: (device: Device) => void;
  isSelected: boolean;
  key?: string | number;
}) => {
  const thresholds = device.thresholds || { green: 20, yellow: 50, red: 100 };
  
  const getLatencyColor = (latency: number) => {
    if (device.status === 'offline') return "text-[var(--neon-red)]";
    if (latency < thresholds.green) return "text-[var(--neon-green)]";
    if (latency < thresholds.yellow) return "text-[var(--neon-yellow)]";
    return "text-[var(--neon-red)]";
  };

  const getBarColor = (latency: number, limit: number) => {
    if (device.status === 'offline') return "bg-muted";
    return latency < limit ? "bg-[var(--neon-green)]" : "bg-muted";
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onThresholds(device);
  };

  return (
    <motion.div
      layout
      onClick={onClick}
      onDoubleClick={() => onThresholds(device)}
      onContextMenu={handleContextMenu}
      className={cn(
        "p-3 rounded border cursor-pointer transition-all duration-200 group relative overflow-hidden",
        device.status === 'online' 
          ? "border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5 hover:bg-[var(--neon-green)]/10" 
          : "border-[var(--neon-red)]/30 bg-[var(--neon-red)]/5 hover:bg-[var(--neon-red)]/10",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {device.status === 'online' ? (
            <CheckCircle2 size={14} className="text-[var(--neon-green)]" />
          ) : (
            <AlertTriangle size={14} className="text-[var(--neon-red)]" />
          )}
          <span className="font-mono text-sm font-bold">{device.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onEdit}
            className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
          >
            <Edit2 size={12} />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(device.id);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[var(--neon-red)] transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground font-mono mb-2">{device.ip}</div>
      <div className="flex justify-between items-end">
        <span className={cn(
          "text-lg font-mono font-bold",
          getLatencyColor(device.latency)
        )}>
          {device.status === 'online' ? `${device.latency} ms` : 'TIMEOUT'}
        </span>
        <div className="flex gap-1">
          <div className={cn("w-1 h-3 rounded-full", getBarColor(device.latency, thresholds.green))} />
          <div className={cn("w-1 h-3 rounded-full", getBarColor(device.latency, thresholds.yellow))} />
          <div className={cn("w-1 h-3 rounded-full", getBarColor(device.latency, thresholds.red))} />
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [groups, setGroups] = useState<GroupWithDevices[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<'visual' | 'list'>('visual');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isFetchingStatus, setIsFetchingStatus] = useState(false);
  const [monitorInterval, setMonitorInterval] = useState(1);
  const [monitorTimeout, setMonitorTimeout] = useState(1);

  const safeMonitorInterval = Math.max(1, monitorInterval || 1);
  const safeMonitorTimeout = Math.max(1, monitorTimeout || 1);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [isAddingDeviceLoading, setIsAddingDeviceLoading] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isRenamingGroup, setIsRenamingGroup] = useState<string | null>(null);
  const [isEditingDevice, setIsEditingDevice] = useState<string | null>(null);
  const [isEditingDeviceLoading, setIsEditingDeviceLoading] = useState(false);
  const [isSettingThresholds, setIsSettingThresholds] = useState<string | null>(null);
  const [thresholdData, setThresholdData] = useState({ green: 20, yellow: 50, red: 100 });
  const [isScanning, setIsScanning] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', ip: '', groupId: '' });
  const [editingDeviceData, setEditingDeviceData] = useState({ name: '', ip: '', groupId: '' });
  const [newGroupName, setNewGroupName] = useState('');
  const [historyMap, setHistoryMap] = useState<Record<string, { time: string; latency: number }[]>>({});
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  // --- Derived Stats ---
  const allDevices = useMemo(() => groups.flatMap(g => g.devices), [groups]);
  
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.map(group => ({
      ...group,
      devices: group.devices.filter(device => 
        device.name.toLowerCase().includes(query) || 
        device.ip.toLowerCase().includes(query)
      )
    })).filter(group => group.devices.length > 0);
  }, [groups, searchQuery]);

  const filteredAllDevices = useMemo(() => 
    allDevices.filter(device => 
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      device.ip.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [allDevices, searchQuery]
  );
  const onlineCount = allDevices.filter(d => d.status === 'online').length;
  const offlineCount = allDevices.length - onlineCount;
  const avgLatency = Math.round(allDevices.reduce((acc, d) => acc + d.latency, 0) / (onlineCount || 1));
  const avgLoss = ((offlineCount / (allDevices.length || 1)) * 100).toFixed(1);

  const selectedDevice = useMemo(() => 
    allDevices.find(d => d.id === selectedDeviceId), 
    [allDevices, selectedDeviceId]
  );

  // --- Effects ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close any open modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmModal.show) { setConfirmModal(prev => ({ ...prev, show: false })); return; }
      if (isSettingThresholds) { setIsSettingThresholds(null); return; }
      if (isEditingDevice) { setIsEditingDevice(null); return; }
      if (isAddingDevice) { setIsAddingDevice(false); return; }
      if (isRenamingGroup) { setIsRenamingGroup(null); return; }
      if (isAddingGroup) { setIsAddingGroup(false); return; }
      if (selectedDeviceId) { setSelectedDeviceId(null); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmModal.show, isSettingThresholds, isEditingDevice, isAddingDevice, isRenamingGroup, isAddingGroup, selectedDeviceId]);

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups');
      const data = await response.json();
      setAvailableGroups(data);
      if (!newDevice.groupId && data.length > 0) {
        setNewDevice(prev => ({ ...prev, groupId: data[0].id }));
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      toast.error("Failed to connect to server. Please check your connection.");
    }
  };

  const isFetchingRef = useRef(false);
  const historyMapRef = useRef<Record<string, { time: string; latency: number }[]>>({});
  const availableGroupsRef = useRef<Group[]>([]);
  const monitorTimeoutRef = useRef(1);

  const fetchStatus = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsFetchingStatus(true);
    try {
      const response = await fetch(`/api/status?timeout=${monitorTimeoutRef.current}`);
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error("Invalid data format received from server");
      }

      // Use ref to always get the latest historyMap (avoids stale closure)
      const updatedHistoryMap = { ...historyMapRef.current };
      data.forEach((d: any) => {
        const currentHistory = updatedHistoryMap[d.id] || [];
        updatedHistoryMap[d.id] = [
          ...currentHistory.slice(-59), // Keep 60 points for 60s history
          { time: format(new Date(), 'hh:mm:ss a'), latency: d.latency }
        ];
      });
      historyMapRef.current = updatedHistoryMap;
      setHistoryMap(updatedHistoryMap);

      // Group devices using the updated history
      const grouped: Record<string, Device[]> = {};
      data.forEach((d: any) => {
        const groupId = d.groupId || 'default-general';
        if (!grouped[groupId]) grouped[groupId] = [];
        grouped[groupId].push({
          ...d,
          history: updatedHistoryMap[d.id] || []
        });
      });

      // Use ref to always get the latest availableGroups (avoids stale closure)
      setGroups(availableGroupsRef.current.map(g => ({
        ...g,
        devices: grouped[g.id] || []
      })));
    } catch (error) {
      console.error("Failed to fetch status:", error);
      toast.error("Failed to update device status. Server might be unreachable.");
    } finally {
      isFetchingRef.current = false;
      setIsFetchingStatus(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    availableGroupsRef.current = availableGroups;
    if (availableGroups.length > 0) {
      fetchStatus();
      handleScan(true); // Auto-detect network devices after groups are ready
      if (!newDevice.groupId) {
        setNewDevice(prev => ({ ...prev, groupId: availableGroups[0].id }));
      }
    }
  }, [availableGroups.length]);

  // Keep monitorTimeoutRef in sync so fetchStatus always uses the latest value
  useEffect(() => {
    monitorTimeoutRef.current = safeMonitorTimeout;
  }, [safeMonitorTimeout]);

  useEffect(() => {
    if (!isMonitoring) return;
    const interval = setInterval(fetchStatus, safeMonitorInterval * 1000);
    return () => clearInterval(interval);
  }, [isMonitoring, safeMonitorInterval]);

  const handleAddDevice = async () => {
    if (!newDevice.name) {
      toast.error("Please enter a device name.");
      return;
    }
    if (!newDevice.groupId) {
      toast.error("Please select a group. If no groups exist, create one first.");
      return;
    }
    setIsAddingDeviceLoading(true);
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to add device");
        return;
      }

      setIsAddingDevice(false);
      setNewDevice({ name: '', ip: '', groupId: availableGroups[0]?.id || '' });
      fetchStatus();
      toast.success("Device added successfully");
    } catch (error) {
      console.error("Failed to add device:", error);
      toast.error("An unexpected error occurred while adding the device.");
    } finally {
      setIsAddingDeviceLoading(false);
    }
  };

  const handleUpdateDevice = async () => {
    if (!isEditingDevice || !editingDeviceData.name || !editingDeviceData.groupId) return;
    setIsEditingDeviceLoading(true);
    try {
      const response = await fetch(`/api/devices/${isEditingDevice}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDeviceData)
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to update device");
        return;
      }

      setIsEditingDevice(null);
      fetchStatus();
      toast.success("Device updated successfully");
    } catch (error) {
      console.error("Failed to update device:", error);
      toast.error("An unexpected error occurred while updating the device.");
    } finally {
      setIsEditingDeviceLoading(false);
    }
  };

  const handleUpdateThresholds = async () => {
    if (!isSettingThresholds) return;
    if (thresholdData.green >= thresholdData.yellow) {
      toast.error("Green threshold must be less than Yellow.");
      return;
    }
    if (thresholdData.yellow >= thresholdData.red) {
      toast.error("Yellow threshold must be less than Red.");
      return;
    }
    try {
      const response = await fetch(`/api/devices/${isSettingThresholds}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds: thresholdData })
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to update thresholds");
        return;
      }

      setIsSettingThresholds(null);
      fetchStatus();
      toast.success("Thresholds updated successfully");
    } catch (error) {
      console.error("Failed to update thresholds:", error);
      toast.error("An unexpected error occurred.");
    }
  };

  const handleScan = async (isSilent: boolean = false) => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/scan', { method: 'POST' });
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || "Failed to scan network");
        if (data.details) console.error("Scan details:", data.details);
        return;
      }

      if (!isSilent) {
        toast.success(data.message);
      }
      fetchStatus();
    } catch (error) {
      console.error("Failed to scan network:", error);
      toast.error("An error occurred while scanning the network.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "IP", "Group", "Status", "Latency (ms)", "Last Checked"];
    
    // Helper to escape CSV values
    const escapeCSV = (val: string | number) => {
      const stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    };

    const rows = allDevices.map(device => [
      escapeCSV(device.id),
      escapeCSV(device.name),
      escapeCSV(device.ip),
      escapeCSV(device.group),
      escapeCSV(device.status),
      escapeCSV(device.latency),
      escapeCSV(device.lastChecked ? format(new Date(device.lastChecked), 'yyyy-MM-dd hh:mm:ss a') : 'N/A')
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ping_monitor_export_${format(new Date(), 'yyyyMMdd_hhmmss_a')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddGroup = async () => {
    if (!newGroupName) {
      toast.error("Please enter a group name.");
      return;
    }
    try {
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName })
      });
      setIsAddingGroup(false);
      setNewGroupName('');
      fetchGroups();
      toast.success("Group created successfully");
    } catch (error) {
      console.error("Failed to add group:", error);
      toast.error("Failed to create group.");
    }
  };

  const handleRenameGroup = async (id: string, name: string) => {
    try {
      await fetch(`/api/groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      setIsRenamingGroup(null);
      fetchGroups();
      toast.success("Group renamed successfully");
    } catch (error) {
      console.error("Failed to rename group:", error);
      toast.error("Failed to rename group.");
    }
  };

  const handleDeleteGroup = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'DELETE GROUP',
      message: 'Are you sure? Devices in this group will be moved to General.',
      onConfirm: async () => {
        try {
          await fetch(`/api/groups/${id}`, { method: 'DELETE' });
          fetchGroups();
          toast.success("Group deleted");
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          console.error("Failed to delete group:", error);
          toast.error("Failed to delete group.");
        }
      }
    });
  };

  const handleDeleteDevice = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'DELETE DEVICE',
      message: 'Are you sure you want to delete this device?',
      onConfirm: async () => {
        try {
          await fetch(`/api/devices/${id}`, { method: 'DELETE' });
          fetchStatus();
          if (selectedDeviceId === id) setSelectedDeviceId(null);
          toast.success("Device deleted");
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          console.error("Failed to delete device:", error);
          toast.error("Failed to delete device.");
        }
      }
    });
  };

  const handleClearAllData = () => {
    setConfirmModal({
      show: true,
      title: 'CLEAR ALL DATA',
      message: 'DANGER: This will delete all devices and groups. This action cannot be undone. Proceed?',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/clear-all', { method: 'POST' });
          if (!response.ok) throw new Error("Failed to clear data");
          
          setSelectedDeviceId(null);
          fetchGroups();
          fetchStatus();
          toast.success("All data cleared");
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (error) {
          console.error("Failed to clear data:", error);
          toast.error("Failed to clear data.");
        }
      }
    });
  };

  return (
    <div className="h-screen w-full bg-background text-foreground font-sans selection:bg-primary/30 overflow-hidden">
      {/* Main Content */}
      <main className="h-full flex flex-col min-w-0 grid-bg">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 mr-4">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-[0_0_15px_rgba(0,242,255,0.5)]">
                <Activity size={20} />
              </div>
              <span className="font-mono font-bold tracking-tighter text-lg neon-text text-primary">
                PING MONITOR
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>AUTONOMOUS</span>
              <ChevronRight size={12} />
              <span>NETWORK</span>
              <ChevronRight size={12} />
              <span className="text-foreground font-bold">DISCOVERY & ANALYSIS</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:flex items-center gap-2 bg-card/50 border border-border rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                INT:
                <input 
                  type="number" 
                  min={1}
                  value={monitorInterval} 
                  onChange={(e) => setMonitorInterval(Number(e.target.value))}
                  className="w-8 bg-transparent border-none focus:ring-0 p-0 text-foreground font-bold" 
                />
              </div>
              <div className="w-px h-3 bg-border mx-1" />
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                TO:
                <input 
                  type="number" 
                  min={1}
                  value={monitorTimeout} 
                  onChange={(e) => setMonitorTimeout(Number(e.target.value))}
                  className="w-8 bg-transparent border-none focus:ring-0 p-0 text-foreground font-bold" 
                />
              </div>
              <div className="w-px h-3 bg-border mx-1" />
              <button 
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                  isMonitoring 
                    ? "text-destructive hover:bg-destructive/10" 
                    : "text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10"
                )}
              >
                {isMonitoring ? <><StopCircle size={12} /> STOP</> : <><Play size={12} /> START</>}
              </button>
            </div>

            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text" 
                placeholder="Search devices..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card border border-border rounded-full pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-32 md:w-64"
              />
            </div>
            <div className="text-[10px] md:text-xs font-mono text-muted-foreground bg-card px-2 md:px-3 py-1.5 rounded-full border border-border whitespace-nowrap">
              {format(currentTime, 'hh:mm:ss a')}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Total Devices" value={allDevices.length} icon={Globe} color="cyan" />
            <StatCard label="Online" value={onlineCount} icon={CheckCircle2} color="green" />
            <StatCard label="Offline" value={offlineCount} icon={AlertTriangle} color="red" />
            <StatCard label="Avg Loss" value={`${avgLoss}%`} icon={Activity} color="red" />
            <StatCard label="Avg RTT" value={`${avgLatency}ms`} icon={Clock} color="cyan" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-col gap-4 bg-card/30 p-4 rounded-lg border border-border">
            {/* Top Row: Monitoring Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  INTERVAL (S):
                  <input 
                    type="number" 
                    min={1}
                    value={monitorInterval} 
                    onChange={(e) => setMonitorInterval(Number(e.target.value))}
                    className="w-12 bg-card border border-border rounded px-1 py-0.5 text-foreground" 
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                  TIMEOUT (S):
                  <input 
                    type="number" 
                    min={1}
                    value={monitorTimeout} 
                    onChange={(e) => setMonitorTimeout(Number(e.target.value))}
                    className="w-12 bg-card border border-border rounded px-1 py-0.5 text-foreground" 
                  />
                </div>
                <div className="w-px h-6 bg-border" />
                <button 
                  onClick={() => setIsMonitoring(!isMonitoring)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-all",
                    isMonitoring 
                      ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20" 
                      : "bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/30 hover:bg-[var(--neon-green)]/20"
                  )}
                >
                  {isMonitoring ? <><StopCircle size={14} /> STOP</> : <><Play size={14} /> START</>}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground border border-border rounded text-xs font-bold hover:bg-muted/80 transition-all"
                >
                  <Download size={14} /> EXPORT CSV
                </button>
                <button 
                  onClick={handleClearAllData}
                  className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive border border-destructive/30 rounded text-xs font-bold hover:bg-destructive/20 transition-all"
                >
                  <Trash2 size={14} /> CLEAR ALL
                </button>
              </div>
            </div>

            {/* Bottom Row: Add Actions (Broken to new line on mobile) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
              <button 
                onClick={() => setIsAddingGroup(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded text-xs font-bold hover:bg-primary/20 transition-all"
              >
                <Plus size={14} /> ADD GROUP
              </button>
              <button 
                onClick={() => setIsAddingDevice(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded text-xs font-bold hover:bg-primary/20 transition-all"
              >
                <Plus size={14} /> ADD DEVICE
              </button>
              <button 
                onClick={() => handleScan(false)}
                disabled={isScanning}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground border border-border rounded text-xs font-bold hover:bg-muted/80 transition-all disabled:opacity-50"
              >
                {isScanning ? <><Loader2 size={14} className="animate-spin" /> SCANNING...</> : <><Wifi size={14} /> SCAN NETWORK</>}
              </button>
            </div>
          </div>

          {/* Main View Area */}
          <div className="flex flex-col gap-6 flex-1 min-h-0">
            {/* Left Panel: Dashboard/List */}
            <div className="flex-1 flex flex-col bg-card/30 rounded-xl border border-border overflow-hidden min-h-[400px] lg:min-h-0">
              <div className="flex border-b border-border">
                <button 
                  onClick={() => setActiveTab('visual')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-widest transition-all relative",
                    activeTab === 'visual' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutDashboard size={14} /> VISUAL DASHBOARD
                  {activeTab === 'visual' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_10px_rgba(0,242,255,1)]" />}
                </button>
                <button 
                  onClick={() => setActiveTab('list')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 text-xs font-bold tracking-widest transition-all relative",
                    activeTab === 'list' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List size={14} /> DEVICE LIST
                  {activeTab === 'list' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_10px_rgba(0,242,255,1)]" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <AnimatePresence mode="wait">
                  {activeTab === 'visual' ? (
                    <motion.div 
                      key="visual"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                    >
                      {filteredGroups.length === 0 && allDevices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground font-mono">
                          <Wifi size={48} className="mb-4 opacity-20" />
                          <p className="text-sm uppercase tracking-widest opacity-50">No devices found</p>
                          <p className="text-[10px] mt-2 opacity-30">Click SCAN NETWORK or ADD DEVICE to get started</p>
                        </div>
                      ) : filteredGroups.map(group => (
                        <div key={group.id} className="space-y-3">
                          <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-mono font-bold text-sm tracking-widest text-primary">{group.name}</h3>
                              <span className="text-[10px] text-muted-foreground">({group.devices.length} devices)</span>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setIsRenamingGroup(group.id);
                                  setNewGroupName(group.name);
                                }}
                                className="p-1 text-muted-foreground hover:text-primary transition-all"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteGroup(group.id)}
                                className="p-1 text-muted-foreground hover:text-[var(--neon-red)] transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {group.devices.map(device => (
                              <DeviceCard 
                                key={device.id} 
                                device={device} 
                                onClick={() => setSelectedDeviceId(device.id)}
                                onDelete={handleDeleteDevice}
                                onThresholds={(d) => {
                                  setIsSettingThresholds(d.id);
                                  setThresholdData(d.thresholds || { green: 20, yellow: 50, red: 100 });
                                }}
                                onEdit={(e) => {
                                  e.stopPropagation();
                                  setIsEditingDevice(device.id);
                                  setEditingDeviceData({
                                    name: device.name,
                                    ip: device.ip,
                                    groupId: device.groupId
                                  });
                                }}
                                isSelected={selectedDeviceId === device.id}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="list"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="overflow-x-auto"
                    >
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                            <th className="px-4 py-3 font-bold">Status</th>
                            <th className="px-4 py-3 font-bold">Device Name</th>
                            <th className="px-4 py-3 font-bold">IP Address</th>
                            <th className="px-4 py-3 font-bold">Latency</th>
                            <th className="px-4 py-3 font-bold">Last Check</th>
                            <th className="px-4 py-3 font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs font-mono">
                          {filteredAllDevices.map(device => {
                            const thresholds = device.thresholds || { green: 20, yellow: 50, red: 100 };
                            const getLatencyColor = (latency: number) => {
                              if (device.status === 'offline') return "text-[var(--neon-red)]";
                              if (latency < thresholds.green) return "text-[var(--neon-green)]";
                              if (latency < thresholds.yellow) return "text-[var(--neon-yellow)]";
                              return "text-[var(--neon-red)]";
                            };
                            const getStatusDotColor = (latency: number) => {
                              if (device.status === 'offline') return "bg-[var(--neon-red)]";
                              if (latency < thresholds.green) return "bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)]";
                              if (latency < thresholds.yellow) return "bg-[var(--neon-yellow)] shadow-[0_0_8px_var(--neon-yellow)]";
                              return "bg-[var(--neon-red)] shadow-[0_0_8px_var(--neon-red)]";
                            };

                            return (
                              <tr 
                                key={device.id} 
                                onClick={() => setSelectedDeviceId(device.id)}
                                onDoubleClick={() => {
                                  setIsSettingThresholds(device.id);
                                  setThresholdData(device.thresholds || { green: 20, yellow: 50, red: 100 });
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setIsSettingThresholds(device.id);
                                  setThresholdData(device.thresholds || { green: 20, yellow: 50, red: 100 });
                                }}
                                className={cn(
                                  "border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-all",
                                  selectedDeviceId === device.id && "bg-primary/5"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    getStatusDotColor(device.latency)
                                  )} />
                                </td>
                                <td className="px-4 py-3 font-bold">{device.name}</td>
                                <td className="px-4 py-3 text-muted-foreground">{device.ip}</td>
                                <td className={cn(
                                  "px-4 py-3 font-bold",
                                  getLatencyColor(device.latency)
                                )}>
                                  {device.status === 'online' ? `${device.latency}ms` : 'TIMEOUT'}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{format(new Date(device.lastChecked), 'hh:mm:ss a')}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsSettingThresholds(device.id);
                                        setThresholdData(device.thresholds || { green: 20, yellow: 50, red: 100 });
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary transition-all"
                                      title="Set Thresholds"
                                    >
                                      <Settings size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditingDevice(device.id);
                                        setEditingDeviceData({
                                          name: device.name,
                                          ip: device.ip,
                                          groupId: device.groupId
                                        });
                                      }}
                                      className="p-1 text-muted-foreground hover:text-primary transition-all"
                                      title="Edit Device"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDevice(device.id);
                                      }}
                                      className="p-1 text-muted-foreground hover:text-[var(--neon-red)] transition-all"
                                      title="Delete Device"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Add Group Modal */}
        {isAddingGroup && (
          <div className="fixed inset-0 bg-background/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card/90 backdrop-blur-xl border border-border p-6 rounded-xl w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-4 text-primary neon-text">CREATE NEW GROUP</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Group Name</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                    autoFocus
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Data Center"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setIsAddingGroup(false)}
                  className="flex-1 py-2 rounded border border-border hover:bg-muted transition-all text-xs font-bold"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleAddGroup}
                  className="flex-1 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-bold"
                >
                  CREATE GROUP
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Rename Group Modal */}
        {isRenamingGroup && (
          <div className="fixed inset-0 bg-background/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card/90 backdrop-blur-xl border border-border p-6 rounded-xl w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-4 text-primary neon-text">RENAME GROUP</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">New Name</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRenameGroup(isRenamingGroup!, newGroupName)}
                    autoFocus
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setIsRenamingGroup(null)}
                  className="flex-1 py-2 rounded border border-border hover:bg-muted transition-all text-xs font-bold"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => handleRenameGroup(isRenamingGroup, newGroupName)}
                  className="flex-1 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-bold"
                >
                  SAVE CHANGES
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Edit Device Modal */}
        {isEditingDevice && (
          <div className="fixed inset-0 bg-background/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card/90 backdrop-blur-xl border border-border p-6 rounded-xl w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-4 text-primary neon-text">EDIT DEVICE</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Device Name</label>
                  <input 
                    type="text" 
                    value={editingDeviceData.name}
                    onChange={e => setEditingDeviceData({...editingDeviceData, name: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && handleUpdateDevice()}
                    autoFocus
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Server-01"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">IP Address / Domain (Optional)</label>
                  <input 
                    type="text" 
                    value={editingDeviceData.ip}
                    onChange={e => setEditingDeviceData({...editingDeviceData, ip: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && handleUpdateDevice()}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. 192.168.1.1 or leave empty to resolve from name"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Group</label>
                  <select 
                    value={editingDeviceData.groupId}
                    onChange={e => setEditingDeviceData({...editingDeviceData, groupId: e.target.value})}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                  >
                    {availableGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setIsEditingDevice(null)}
                  className="flex-1 py-2 rounded border border-border hover:bg-muted transition-all text-xs font-bold"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleUpdateDevice}
                  disabled={isEditingDeviceLoading}
                  className={cn(
                    "flex-1 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-bold flex items-center justify-center gap-2",
                    isEditingDeviceLoading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {isEditingDeviceLoading ? <><Loader2 size={14} className="animate-spin" /> UPDATING...</> : "SAVE CHANGES"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingDevice && (
          <div className="fixed inset-0 bg-background/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card/90 backdrop-blur-xl border border-border p-6 rounded-xl w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-4 text-primary neon-text">ADD NEW DEVICE</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Device Name</label>
                  <input 
                    type="text" 
                    value={newDevice.name}
                    onChange={e => setNewDevice({...newDevice, name: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && handleAddDevice()}
                    autoFocus
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. Server-01"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">IP Address / Domain (Optional)</label>
                  <input 
                    type="text" 
                    value={newDevice.ip}
                    onChange={e => setNewDevice({...newDevice, ip: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && handleAddDevice()}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. 192.168.1.1 or leave empty to resolve from name"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Group</label>
                  {availableGroups.length > 0 ? (
                    <select 
                      value={newDevice.groupId}
                      onChange={e => setNewDevice({...newDevice, groupId: e.target.value})}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      {availableGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[10px] text-destructive uppercase font-bold p-2 border border-destructive/20 bg-destructive/5 rounded">
                      No groups found. Please add a group first.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setIsAddingDevice(false)}
                  className="flex-1 py-2 rounded border border-border hover:bg-muted transition-all text-xs font-bold"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleAddDevice}
                  disabled={isAddingDeviceLoading}
                  className={cn(
                    "flex-1 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-bold flex items-center justify-center gap-2",
                    isAddingDeviceLoading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {isAddingDeviceLoading ? <><Loader2 size={14} className="animate-spin" /> ADDING...</> : "ADD DEVICE"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Threshold Modal */}
        {isSettingThresholds && (
          <div className="fixed inset-0 bg-background/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card/90 backdrop-blur-xl border border-border p-6 rounded-xl w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-bold mb-4 text-primary neon-text">SET RTT THRESHOLDS</h3>
              <p className="text-[10px] text-muted-foreground mb-4 uppercase tracking-widest">Configure status color triggers for this device (ms)</p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)]" />
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Green Threshold (RTT &lt; X)</label>
                    <input 
                      type="number" 
                      min={1} max={9999}
                      value={thresholdData.green}
                      onChange={e => setThresholdData({...thresholdData, green: Math.max(1, Number(e.target.value))})}
                      onKeyDown={e => e.key === 'Enter' && handleUpdateThresholds()}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-[var(--neon-yellow)] shadow-[0_0_8px_var(--neon-yellow)]" />
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Yellow Threshold (RTT &lt; X)</label>
                    <input 
                      type="number" 
                      min={1} max={9999}
                      value={thresholdData.yellow}
                      onChange={e => setThresholdData({...thresholdData, yellow: Math.max(1, Number(e.target.value))})}
                      onKeyDown={e => e.key === 'Enter' && handleUpdateThresholds()}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-[var(--neon-red)] shadow-[0_0_8px_var(--neon-red)]" />
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Red Threshold (RTT &lt; X)</label>
                    <input 
                      type="number" 
                      min={1} max={9999}
                      value={thresholdData.red}
                      onChange={e => setThresholdData({...thresholdData, red: Math.max(1, Number(e.target.value))})}
                      onKeyDown={e => e.key === 'Enter' && handleUpdateThresholds()}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setIsSettingThresholds(null)}
                  className="flex-1 py-2 rounded border border-border hover:bg-muted transition-all text-xs font-bold"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleUpdateThresholds}
                  className="flex-1 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-bold"
                >
                  SAVE THRESHOLDS
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Device Detail History Panel */}
        <AnimatePresence>
          {selectedDevice && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border bg-card/30 backdrop-blur-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Real-time Latency Analysis</span>
                      <h2 className="text-xl font-bold font-mono text-primary neon-text">{selectedDevice.name} <span className="text-muted-foreground text-sm">({selectedDevice.ip})</span></h2>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedDeviceId(null)}
                    className="p-2 text-muted-foreground hover:text-foreground transition-all"
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedDevice.history}>
                      <defs>
                        <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--neon-cyan)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--neon-cyan)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="time" 
                        hide 
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickFormatter={(val) => `${val}ms`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          borderRadius: '8px',
                          fontSize: '10px',
                          color: '#f8fafc'
                        }}
                        itemStyle={{ color: 'var(--neon-cyan)' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="var(--neon-cyan)" 
                        fillOpacity={1} 
                        fill="url(#colorLatency)" 
                        strokeWidth={2}
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        <footer className="h-8 border-t border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_var(--neon-cyan)]" />
                <span className="text-primary font-bold">SYSTEM</span>
              </div>
              <span className="opacity-50">|</span>
              <div className="flex items-center gap-2">
                {selectedDevice ? (
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/80">{selectedDevice.name}</span>
                    <span className="opacity-30">/</span>
                    <span className="text-muted-foreground">{selectedDevice.ip}</span>
                    <span className="opacity-30">/</span>
                    <span className={cn(
                      "font-bold",
                      selectedDevice.status === 'online' ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]"
                    )}>
                      {selectedDevice.status}
                    </span>
                    <span className="opacity-30">/</span>
                    <span className="text-primary">{selectedDevice.latency}ms</span>
                  </div>
                ) : (
                  <span className="text-foreground/80">NETWORK MONITORING ACTIVE</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-foreground/60">
              <span>© {new Date().getFullYear()} Ahmed Morgan</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                isFetchingStatus
                  ? "bg-[var(--neon-cyan)] animate-ping"
                  : isMonitoring
                    ? "bg-[var(--neon-green)] animate-pulse"
                    : "bg-muted-foreground"
              )} />
              <span className={cn(
                isFetchingStatus ? "text-[var(--neon-cyan)]/80" : isMonitoring ? "text-[var(--neon-green)]/80" : "text-muted-foreground/50"
              )}>
                {isFetchingStatus ? "POLLING" : isMonitoring ? "LIVE FEED" : "PAUSED"}
              </span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-2">
              <Wifi size={10} className="text-primary" />
              <span>{format(currentTime, 'yyyy.MM.dd hh:mm:ss a')}</span>
            </div>
          </div>
        </footer>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmModal.show && (
            <div className="fixed inset-0 bg-background/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card/90 backdrop-blur-xl border border-border p-6 rounded-xl w-full max-w-sm shadow-2xl"
              >
                <div className="flex items-center gap-3 mb-4 text-[var(--neon-red)]">
                  <AlertTriangle size={20} />
                  <h3 className="text-lg font-bold neon-text uppercase tracking-tighter">{confirmModal.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6 font-mono leading-relaxed">
                  {confirmModal.message}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 py-2 rounded border border-border hover:bg-muted transition-all text-xs font-bold font-mono"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="flex-1 py-2 rounded bg-[var(--neon-red)] text-white hover:bg-[var(--neon-red)]/90 transition-all text-xs font-bold font-mono"
                  >
                    CONFIRM
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <Toaster position="bottom-right" theme="dark" richColors />
      </main>
    </div>
  );
}
