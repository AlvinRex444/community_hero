/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Issue, UserStats, NeighborhoodStats, PredictiveInsight, Comment } from './types';
import InteractiveMap from './components/InteractiveMap';
import AuthContainer from './components/AuthContainer';
import {
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  ThumbsUp,
  MessageSquare,
  Plus,
  Compass,
  Award,
  Sparkles,
  Search,
  Filter,
  TrendingUp,
  ChevronRight,
  Upload,
  User,
  Shield,
  Loader2,
  Calendar,
  X,
  Camera,
  Activity,
  Droplet,
  Navigation,
  LogOut
} from 'lucide-react';

// Preset sample photos for fast testing and AI-multimodal analysis
const PRESET_PHOTOS = [
  {
    name: 'Gushing Broken Water Main',
    url: 'https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&q=80&w=600',
    description: 'A burst water pipe spraying water onto the sidewalk.'
  },
  {
    name: 'Deep Asphalt Pothole',
    url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=600',
    description: 'A deep pothole in the middle of a two-lane asphalt road.'
  },
  {
    name: 'Exposed Broken Streetlight Base',
    url: 'https://images.unsplash.com/photo-1509024644558-2f56ce76c490?auto=format&fit=crop&q=80&w=600',
    description: 'An unlit or damaged streetlamp fixture at dusk.'
  },
  {
    name: 'Illegal Mattresses & Paint Cans Alley Dumping',
    url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=600',
    description: 'Piles of household garbage and construction refuse dumped illegally.'
  }
];

// Helper to format Osm or other address strings into detailed lines
const formatDetailedAddress = (addressStr: string) => {
  if (!addressStr) return { line1: 'Unknown Location', line2: '' };
  
  // Clean up any double spaces, trailing commas
  const cleanStr = addressStr.replace(/\s+/g, ' ').trim();
  const parts = cleanStr.split(',').map(s => s.trim()).filter(Boolean);
  
  if (parts.length < 2) {
    return { line1: addressStr, line2: '' };
  }

  // Check if it is a Kanpur / India address
  const isIndia = cleanStr.toLowerCase().includes('india') || cleanStr.toLowerCase().includes('uttar pradesh') || cleanStr.toLowerCase().includes('kanpur');
  
  if (isIndia) {
    const first = parts[0];
    // Intelligently look for Kalyanpur
    const kalyanpurPart = parts.find(p => p.toLowerCase().includes('kalyanpur'));
    let line1 = first;
    if (kalyanpurPart && first.toLowerCase() !== kalyanpurPart.toLowerCase()) {
      line1 = `${first}, ${kalyanpurPart}`;
    } else if (parts[1] && !parts[1].toLowerCase().includes('kanpur')) {
      line1 = `${first}, ${parts[1]}`;
    }
    
    // City & State
    const cityPart = parts.find(p => p.toLowerCase().includes('kanpur')) || 'Kanpur';
    const statePart = parts.find(p => p.toLowerCase().includes('uttar pradesh')) || 'Uttar Pradesh';
    
    const line2 = `${cityPart}, ${statePart}`;
    return { line1, line2 };
  }
  
  // Generic fallback: line1 gets first 2 elements, line2 gets the rest
  const line1 = parts.slice(0, Math.min(2, parts.length - 1)).join(', ');
  const line2 = parts.slice(Math.min(2, parts.length - 1)).join(', ');
  return { line1, line2 };
};

// Haversine formula to compute distance between two coordinate pairs in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
};

export default function App() {
  // State
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Live GPS Location');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [stats, setStats] = useState<NeighborhoodStats | null>(null);
  const [insights, setInsights] = useState<PredictiveInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Authentication & session state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem('isGuest') === 'true';
  });
  const [userToken, setUserToken] = useState<string | null>(() => {
    return localStorage.getItem('userToken');
  });

  // Gamification state (persisted locally)
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('userStats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {
      userName: 'Alvin Rex',
      level: 2,
      xp: 240,
      badges: [
        { id: '1', title: 'Civic Starter', description: 'Reported your first community hazard', icon: '🌱', unlockedAt: new Date().toISOString() },
        { id: '2', title: 'Local Sentinel', description: 'Verified 5+ neighborhood reports', icon: '🛡️', unlockedAt: new Date().toISOString() },
      ],
      reportsCount: 4,
      verificationsCount: 6,
      impactPoints: 340,
    };
  });

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Roads & Potholes');
  const [urgency, setUrgency] = useState<string>('Medium');
  const [selectedPresetPhoto, setSelectedPresetPhoto] = useState<string>('');
  const [customPhotoBase64, setCustomPhotoBase64] = useState<string>('');
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number; address: string; accuracy?: number } | null>({
    lat: 26.4227,
    lng: 80.4042,
    address: 'Ashiana Avenue, Kalyanpur, Kanpur, Uttar Pradesh, India',
    accuracy: 8
  });
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'reports' | 'dashboard' | 'insights'>('reports');

  // Notification notification system
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Live Location state
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number; address?: string; accuracy?: number } | null>({
    lat: 26.4227,
    lng: 80.4042,
    address: 'Ashiana Avenue, Kalyanpur, Kanpur, Uttar Pradesh, India',
    accuracy: 8
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Detect Live Location via GPS
  const detectLiveLocation = () => {
    if (!navigator.geolocation) {
      triggerNotification('error', 'Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    triggerNotification('info', 'Requesting live GPS satellite fix...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        triggerNotification('info', `GPS lock acquired: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Fetching address...`);
        
        let resolvedAddress = `Latitude ${lat.toFixed(5)}, Longitude ${lng.toFixed(5)}`;

        try {
          // Live integration: Reverse geocode coordinates to real address via Nominatim (OSM)
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: {
              'User-Agent': 'CommunityHeroApp/1.0'
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.display_name) {
              resolvedAddress = data.display_name;
              // Normalize misspelling of Ashiana in OpenStreetMap data
              resolvedAddress = resolvedAddress.replace(/ahiana/gi, 'Ashiana');
            }
          }
        } catch (err) {
          console.error('Error reverse geocoding coordinates:', err);
        }

        setLiveLocation({ lat, lng, address: resolvedAddress, accuracy });
        setPinLocation({ lat, lng, address: resolvedAddress, accuracy });
        
        triggerNotification('success', `Location locked: ${resolvedAddress.split(',')[0]}`);
        setIsDetectingLocation(false);
      },
      (error) => {
        setIsDetectingLocation(false);
        let errorMsg = 'Could not retrieve your live location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Location permission denied. Please enable geolocation in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'GPS satellite coordinates are currently unavailable.';
            break;
          case error.TIMEOUT:
            errorMsg = 'The request to lock your GPS coordinates timed out.';
            break;
        }
        triggerNotification('error', errorMsg);
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Calculate distance between active user location (GPS or map pin) and an issue
  const getDistanceStr = (issueLat: number, issueLng: number) => {
    const activeUserLoc = liveLocation || pinLocation;
    if (!activeUserLoc) return null;

    const meters = calculateDistance(activeUserLoc.lat, activeUserLoc.lng, issueLat, issueLng);
    if (meters < 1000) {
      return `${Math.round(meters)} m away`;
    } else {
      return `${(meters / 1000).toFixed(1)} km away`;
    }
  };

  // Fetch data whenever selectedNeighborhood changes
  useEffect(() => {
    fetchIssues();
    fetchStats();
    fetchInsights();
    
    // Auto-request live location if selected in dropdown
    if (selectedNeighborhood === 'Live GPS Location' && !liveLocation) {
      detectLiveLocation();
    }
  }, [selectedNeighborhood]);

  const triggerNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  // Sync userStats to localStorage and the backend
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // Save locally
    localStorage.setItem('userStats', JSON.stringify(userStats));

    // Async function to sync to the server
    const syncStats = async () => {
      if (isGuest || !userStats.userName || userStats.userName === 'Guest Sentinel' || userStats.userName === 'Alvin Rex') return;
      try {
        await fetch('/api/auth/update-stats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userName: userStats.userName,
            stats: userStats
          })
        });
      } catch (err) {
        console.error('Failed to sync stats to server:', err);
      }
    };

    syncStats();
  }, [userStats, isLoggedIn, isGuest]);

  const handleAuthSuccess = (user: { id: string; email: string; userName: string; stats: UserStats }, token: string) => {
    setIsLoggedIn(true);
    setIsGuest(false);
    setUserToken(token);
    setUserStats(user.stats);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('isGuest', 'false');
    localStorage.setItem('userToken', token);
    localStorage.setItem('userStats', JSON.stringify(user.stats));
    triggerNotification('success', 'Access authorized. Welcome back, Sentinel!');
  };

  const handleContinueAsGuest = () => {
    setIsLoggedIn(true);
    setIsGuest(true);
    setUserToken(null);
    setUserStats({
      userName: 'Guest Sentinel',
      level: 1,
      xp: 0,
      badges: [],
      reportsCount: 0,
      verificationsCount: 0,
      impactPoints: 0
    });
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('isGuest', 'true');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userStats');
    triggerNotification('success', 'Continuing as Guest (Read-Only Mode).');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsGuest(false);
    setUserToken(null);
    setUserStats({
      userName: 'Alvin Rex',
      level: 2,
      xp: 240,
      badges: [
        { id: '1', title: 'Civic Starter', description: 'Reported your first community hazard', icon: '🌱', unlockedAt: new Date().toISOString() },
        { id: '2', title: 'Local Sentinel', description: 'Verified 5+ neighborhood reports', icon: '🛡️', unlockedAt: new Date().toISOString() },
      ],
      reportsCount: 4,
      verificationsCount: 6,
      impactPoints: 340,
    });
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('isGuest');
    localStorage.removeItem('userToken');
    localStorage.removeItem('userStats');
    triggerNotification('success', 'Logged out successfully.');
  };

  const fetchIssues = async () => {
    try {
      const res = await fetch(`/api/issues?neighborhood=${selectedNeighborhood}`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
        if (data.length > 0) {
          setSelectedIssue(data[0]);
        } else {
          setSelectedIssue(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch issues', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats?neighborhood=${selectedNeighborhood}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchInsights = async () => {
    try {
      const res = await fetch(`/api/insights?neighborhood=${selectedNeighborhood}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      }
    } catch (err) {
      console.error('Failed to fetch insights', err);
    }
  };

  // Upvote/Verify Issue
  const handleVerify = async (id: string) => {
    if (isGuest) {
      triggerNotification('error', 'Guest accounts cannot verify issues. Please register or log in!');
      return;
    }
    try {
      const res = await fetch(`/api/issues/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: userStats.userName }),
      });

      if (res.ok) {
        const updated = await res.json();
        
        // Update issues lists
        setIssues(prev => prev.map(item => item.id === id ? updated : item));
        if (selectedIssue?.id === id) {
          setSelectedIssue(updated);
        }

        // Award Gamification XP and Impact Points
        setUserStats(prev => {
          const newXP = prev.xp + 40;
          const levelUp = newXP >= 500;
          const nextLevel = levelUp ? prev.level + 1 : prev.level;
          const currentXP = levelUp ? newXP - 500 : newXP;

          // Add potential badge
          const updatedBadges = [...prev.badges];
          if (prev.verificationsCount === 9) {
            updatedBadges.push({
              id: 'badge_verify_10',
              title: 'Supreme Validator',
              description: 'Verified 10 local community issues',
              icon: '⚖️',
              unlockedAt: new Date().toISOString()
            });
            triggerNotification('success', '🏆 Badge Unlocked: Supreme Validator!');
          }

          if (levelUp) {
            triggerNotification('success', `🎉 Level Up! You are now Level ${nextLevel}!`);
          } else {
            triggerNotification('success', '+40 XP & +20 Impact Points gained for verification!');
          }

          return {
            ...prev,
            xp: currentXP,
            level: nextLevel,
            verificationsCount: prev.verificationsCount + 1,
            impactPoints: prev.impactPoints + 20,
            badges: updatedBadges
          };
        });

        fetchStats();
      } else {
        const err = await res.json();
        triggerNotification('error', err.error || 'Failed to verify');
      }
    } catch (err) {
      console.error(err);
      triggerNotification('error', 'Error sending verification.');
    }
  };

  // Status Change (Simulation)
  const handleStatusChange = async (id: string, newStatus: string, remarks: string) => {
    try {
      const res = await fetch(`/api/issues/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, remarks }),
      });

      if (res.ok) {
        const updated = await res.json();
        setIssues(prev => prev.map(item => item.id === id ? updated : item));
        setSelectedIssue(updated);
        triggerNotification('success', `Status successfully updated to: ${newStatus}`);
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      triggerNotification('error', 'Guest accounts cannot post comments. Please register or log in!');
      return;
    }
    if (!commentText.trim() || !selectedIssue) return;

    try {
      const res = await fetch(`/api/issues/${selectedIssue.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: userStats.userName,
          text: commentText,
        }),
      });

      if (res.ok) {
        const newComment = await res.json();
        const updatedIssue = {
          ...selectedIssue,
          comments: [...selectedIssue.comments, newComment],
        };
        setIssues(prev => prev.map(item => item.id === selectedIssue.id ? updatedIssue : item));
        setSelectedIssue(updatedIssue);
        setCommentText('');
        triggerNotification('success', 'Comment posted to community timeline');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Issue
  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isGuest) {
      triggerNotification('error', 'Guest accounts cannot submit reports. Please register or log in!');
      return;
    }

    if (!description.trim()) {
      triggerNotification('error', 'Please describe the community issue.');
      return;
    }

    const finalNeighborhood = 'Live GPS Location';

    // Center coordinates based on Kalyanpur, Kanpur
    let defaultLat = 26.4227;
    let defaultLng = 80.4042;
    let fallbackAddressStr = 'Ashiana Avenue, Kalyanpur, Kanpur, Uttar Pradesh, India (Auto-Pin)';

    if (liveLocation) {
      defaultLat = liveLocation.lat;
      defaultLng = liveLocation.lng;
      fallbackAddressStr = liveLocation.address || 'Active GPS Location (Auto-Pin)';
    }

    const reportLocation = pinLocation || {
      lat: defaultLat + (Math.random() - 0.5) * 0.001,
      lng: defaultLng + (Math.random() - 0.5) * 0.001,
      address: fallbackAddressStr,
    };

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim(),
          category,
          urgency,
          location: reportLocation,
          imageUrl: customPhotoBase64 || selectedPresetPhoto || undefined,
          reportedBy: userStats.userName,
          neighborhood: finalNeighborhood,
        }),
      });

      if (response.ok) {
        const newIssue = await response.json();
        setIssues(prev => [newIssue, ...prev]);
        setSelectedIssue(newIssue);

        // Reset Form
        setTitle('');
        setDescription('');
        setSelectedPresetPhoto('');
        setCustomPhotoBase64('');
        setPinLocation(null);

        // Award gamification rewards
        setUserStats(prev => {
          const newXP = prev.xp + 100;
          const levelUp = newXP >= 500;
          const nextLevel = levelUp ? prev.level + 1 : prev.level;
          const currentXP = levelUp ? newXP - 500 : newXP;

          const updatedBadges = [...prev.badges];
          if (prev.reportsCount === 4) {
            updatedBadges.push({
              id: 'badge_report_5',
              title: 'Neighborhood Shield',
              description: 'Reported 5 hazards to make streets safer',
              icon: '⚔️',
              unlockedAt: new Date().toISOString()
            });
            triggerNotification('success', '🏆 Badge Unlocked: Neighborhood Shield!');
          }

          if (levelUp) {
            triggerNotification('success', `🎉 Level Up! You are now Level ${nextLevel}!`);
          } else {
            triggerNotification('success', '🌟 +100 XP & +50 Impact Points! Report processed by Gemini AI.');
          }

          return {
            ...prev,
            xp: currentXP,
            level: nextLevel,
            reportsCount: prev.reportsCount + 1,
            impactPoints: prev.impactPoints + 50,
            badges: updatedBadges
          };
        });

        fetchStats();
        // Shift active tabs back to viewing reports
        setActiveTab('reports');
      } else {
        triggerNotification('error', 'Failed to save issue.');
      }
    } catch (err) {
      console.error(err);
      triggerNotification('error', 'Connection issue. Failed to submit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert custom uploaded image file to Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (e.g. 2MB)
    if (file.size > 2 * 1024 * 1024) {
      triggerNotification('error', 'Image size is too large (max 2MB).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomPhotoBase64(reader.result as string);
      setSelectedPresetPhoto(''); // clear preset
      triggerNotification('success', 'Image successfully attached.');
    };
    reader.readAsDataURL(file);
  };

  // Filter issues based on filters
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.location.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'All' || issue.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || issue.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (!isLoggedIn) {
    return (
      <AuthContainer 
        onAuthSuccess={handleAuthSuccess}
        onContinueAsGuest={handleContinueAsGuest}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950" id="main-root">
      {/* Dynamic Alert Banner */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl transition-all duration-300 transform translate-y-0 scale-100 animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-200'
              : 'bg-slate-900/95 border-slate-700 text-slate-200'
          }`}
          id="toast-notification"
        >
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
          <p className="text-sm font-medium tracking-wide">{notification.text}</p>
        </div>
      )}

      {/* Top Header Grid */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          
          {/* App Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-5.5 h-5.5 text-slate-950" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight font-display bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                  COMMUNITY HERO
                </h1>
                <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  Hyperlocal Solver
                </span>
              </div>
              <p className="text-xs text-slate-400">Collaborative Local Action & Smart AI Infrastructure</p>
            </div>
          </div>

          {/* Active District Selector */}
          <div className="flex items-center gap-2.5 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800/80">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Status:</span>
            <span className="text-emerald-300 text-xs font-bold font-sans">
              📍 Live GPS Active
            </span>
            <button
              onClick={() => detectLiveLocation()}
              disabled={isDetectingLocation}
              className="ml-2 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold font-mono transition uppercase cursor-pointer disabled:opacity-50"
              title="Query GPS coordinates"
            >
              {isDetectingLocation ? 'Syncing...' : 'Sync GPS'}
            </button>
          </div>

          {/* Gamified Citizen Profile Stats */}
          <div className="flex items-center gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 max-w-full sm:max-w-md shadow-inner">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-b from-teal-500 to-emerald-600 flex items-center justify-center text-lg font-bold shadow-md text-slate-950">
                🌱
              </div>
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow">
                {userStats.level}
              </span>
            </div>

            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-200">{userStats.userName}</span>
                <span className="font-mono text-[10px] text-emerald-400 font-bold">{userStats.impactPoints} pts</span>
              </div>
              {/* Progress Bar for XP */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${(userStats.xp / 500) * 100}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1">
                <span>XP Progress: {userStats.xp}/500</span>
                <span>Active Rank: Sentinel</span>
              </div>
            </div>

            {/* Badges Display */}
            <div className="hidden md:flex gap-1">
              {userStats.badges.map(badge => (
                <div
                  key={badge.id}
                  className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-sm border border-slate-700/50"
                  title={`${badge.title}: ${badge.description}`}
                >
                  {badge.icon}
                </div>
              ))}
            </div>

            {/* Logout Action */}
            <button
              onClick={handleLogout}
              className="p-2 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-700/60 hover:border-rose-900/50 text-slate-400 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center"
              title="Sign Out of Portal"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Quick Stats overview cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">Issues Resolved</p>
                <p className="text-xl font-bold text-slate-100">{stats.resolvedIssues} <span className="text-xs text-slate-500">/ {stats.totalIssues} total</span></p>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">Critical Hazards</p>
                <p className="text-xl font-bold text-slate-100">{stats.criticalIssues}</p>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">Avg Resolution</p>
                <p className="text-xl font-bold text-slate-100">{stats.avgResolutionTimeDays} Days</p>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold font-mono">Eco-Impact Saved</p>
                <p className="text-xl font-bold text-slate-100">{stats.impactPointsSaved} Points</p>
              </div>
            </div>
          </div>
        )}

        {/* View Selection Tabs */}
        <div className="flex border-b border-slate-900 mb-6 gap-6">
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'reports'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            Report & Verify Issues
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'insights'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Predictive AI Insights
            <span className="text-[9px] bg-emerald-500 text-slate-950 font-bold px-1 rounded animate-pulse">Gemini</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'dashboard'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Neighborhood Dashboard
          </button>
        </div>

        {/* LOADING SHIMMER */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4" id="loader-view">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <p className="text-slate-400 text-sm">Loading hyperlocal environment database...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: REPORTS AND VERIFICATIONS GRID */}
            {activeTab === 'reports' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="reports-tab-view">
                
                {/* LEFT BLOCK: Report Hazard Form (4 Cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  
                  <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400">
                        <Plus className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h2 className="font-bold text-slate-100">File New Community Report</h2>
                        <p className="text-xs text-slate-400">Gemini AI analyzes & categories instantly</p>
                      </div>
                    </div>

                    <form onSubmit={handleCreateIssue} className="flex flex-col gap-4">
                      
                      {/* Description Area (Most critical part for AI parsing) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Issue Description <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe the issue. (e.g. 'A huge water pipe burst near Pine Road crosswalk, spraying water and flooding the pavement...')"
                          rows={4}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Tip: Detailed descriptions help the AI categorize and assess urgency correctly.
                        </span>
                      </div>

                      {/* Title input (Optional, AI will generate if blank) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Refined Title <span className="text-slate-500 font-normal">(Optional - AI can generate)</span>
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Short title describing the issue"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Manual Select Fallbacks */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Category Fallback</label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                          >
                            <option value="Roads & Potholes">Roads & Potholes</option>
                            <option value="Water & Leakage">Water & Leakage</option>
                            <option value="Waste & Sanitation">Waste & Sanitation</option>
                            <option value="Streetlights">Streetlights</option>
                            <option value="Public Facilities">Public Facilities</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Urgency Fallback</label>
                          <select
                            value={urgency}
                            onChange={(e) => setUrgency(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>
                      </div>

                      {/* Map Location Coordinates Status */}
                      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-slate-400">Map Pin Placement:</span>
                          <span className="text-[10px] text-slate-500">Click Map to set</span>
                        </div>
                        {pinLocation ? (
                          <div className="text-slate-300 font-medium flex flex-col gap-2 mt-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                {(selectedNeighborhood === 'Live GPS Location' || pinLocation.accuracy !== undefined) && (
                                  <div className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase mb-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Live GPS
                                  </div>
                                )}
                                {(() => {
                                  const formatted = formatDetailedAddress(pinLocation.address);
                                  return (
                                    <>
                                      <p className="font-bold text-slate-100 text-xs leading-snug">
                                        {formatted.line1}
                                      </p>
                                      {formatted.line2 && (
                                        <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                                          {formatted.line2}
                                        </p>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500">
                              <div>
                                <span className="text-slate-400 font-semibold">Latitude:</span> {pinLocation.lat.toFixed(5)}
                              </div>
                              <div>
                                <span className="text-slate-400 font-semibold">Longitude:</span> {pinLocation.lng.toFixed(5)}
                              </div>
                              
                              {/* Display accuracy info if present */}
                              {pinLocation.accuracy !== undefined ? (
                                <div className="col-span-2 text-emerald-400/90 font-bold mt-1 font-sans flex items-center gap-1 text-[10.5px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  Accuracy: ±{Math.round(pinLocation.accuracy)} m
                                </div>
                              ) : (
                                (selectedNeighborhood === 'Live GPS Location' || pinLocation.address.includes('Ashiana')) && (
                                  <div className="col-span-2 text-emerald-400/90 font-bold mt-1 font-sans flex items-center gap-1 text-[10.5px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Accuracy: ±8 m
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-500 italic text-[11px] mt-1 flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-slate-500" />
                            Pin will auto-generate or click interactive map.
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={detectLiveLocation}
                          disabled={isDetectingLocation}
                          className="mt-2.5 w-full bg-slate-900 hover:bg-slate-850 active:bg-slate-800 text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/40 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 font-bold transition-all text-[11px] cursor-pointer"
                        >
                          {isDetectingLocation ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              <span>Acquiring Satellites...</span>
                            </>
                          ) : (
                            <>
                              <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                              <span>Use Current Live GPS Location</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* PHOTO ATTACHMENT */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          Attach Photo <span className="text-slate-500 font-normal">(Essential for multimodal AI scanning)</span>
                        </label>
                        
                        {/* File Upload Trigger */}
                        <div className="border border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-3.5 text-center transition-all bg-slate-950 cursor-pointer relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <Upload className="w-5 h-5 text-slate-400" />
                            <span className="text-xs text-slate-300 font-semibold">Upload real local photo</span>
                            <span className="text-[10px] text-slate-500">PNG, JPG up to 2MB</span>
                          </div>
                        </div>

                        {/* Preset Fast Testing selector */}
                        <div className="mt-3">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1.5">
                            Or pick a sample hazard image for fast AI test:
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {PRESET_PHOTOS.map((p, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setSelectedPresetPhoto(p.url);
                                  setCustomPhotoBase64(''); // reset manual upload
                                  triggerNotification('info', `Selected preset: ${p.name}`);
                                }}
                                className={`h-11 rounded-lg border overflow-hidden relative group transition-all ${
                                  selectedPresetPhoto === p.url
                                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                                    : 'border-slate-800 hover:border-slate-700'
                                }`}
                                title={p.name}
                              >
                                <img src={p.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt={p.name} />
                                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent"></div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Photo Attachment Preview */}
                        {(customPhotoBase64 || selectedPresetPhoto) && (
                          <div className="mt-3 p-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <img
                                src={customPhotoBase64 || selectedPresetPhoto}
                                className="w-10 h-10 object-cover rounded-lg"
                                alt="Selected preview"
                              />
                              <div className="overflow-hidden">
                                <p className="text-[11px] text-slate-300 font-semibold truncate">
                                  {customPhotoBase64 ? 'Uploaded Photo' : 'Preset Selected'}
                                </p>
                                <p className="text-[9px] text-slate-500 truncate">Image loaded successfully</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomPhotoBase64('');
                                setSelectedPresetPhoto('');
                              }}
                              className="p-1 rounded bg-slate-900 text-slate-400 hover:text-slate-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Submit Trigger */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 text-xs"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Gemini scanning & submitting...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-slate-950" />
                            <span>Submit AI-Categorized Report (+100 XP)</span>
                          </>
                        )}
                      </button>

                    </form>
                  </div>

                  {/* Citizen Badge Leaderboard Sneak-peek */}
                  <div className="bg-slate-900/20 border border-slate-900 p-4 rounded-xl text-xs flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-300 font-bold mb-1">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <span>Unlocked Citizen Badges</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {userStats.badges.map(b => (
                        <div key={b.id} className="flex gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-xl shrink-0">{b.icon}</span>
                          <div>
                            <p className="font-semibold text-slate-200">{b.title}</p>
                            <p className="text-[10px] text-slate-500 leading-normal">{b.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* MIDDLE & RIGHT BLOCKS: Map, Filters, Feed List, Inspect panel (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  
                  {/* Map Component */}
                  <div className="h-[400px]">
                    <InteractiveMap
                      issues={issues}
                      selectedIssue={selectedIssue}
                      onSelectIssue={(issue) => setSelectedIssue(issue)}
                      pinLocation={pinLocation}
                      onPlacePin={(lat, lng, address) => setPinLocation({ lat, lng, address })}
                      isReporting={true}
                      neighborhood={selectedNeighborhood}
                      liveLocation={liveLocation}
                    />
                  </div>

                  {/* Split Layout: Feed & Details Inspector side-by-side */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    
                    {/* Issues Feed list (6 cols) */}
                    <div className="md:col-span-6 flex flex-col gap-4">
                      
                      {/* Search & Filter bar */}
                      <div className="bg-slate-900/40 border border-slate-900 p-3 rounded-xl flex flex-col gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search keywords or streets..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded-lg p-1.5 focus:outline-none"
                          >
                            <option value="All">All Categories</option>
                            <option value="Roads & Potholes">Roads & Potholes</option>
                            <option value="Water & Leakage">Water & Leakage</option>
                            <option value="Waste & Sanitation">Waste & Sanitation</option>
                            <option value="Streetlights">Streetlights</option>
                            <option value="Public Facilities">Public Facilities</option>
                          </select>

                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded-lg p-1.5 focus:outline-none"
                          >
                            <option value="All">All Statuses</option>
                            <option value="Reported">Reported</option>
                            <option value="Verified">Verified</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </div>
                      </div>

                      {/* FEED ITEM LIST */}
                      <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono uppercase tracking-wider">
                          <span>Issues Found ({filteredIssues.length})</span>
                          <span>Scroll to explore</span>
                        </div>

                        {filteredIssues.length === 0 ? (
                          <div className="bg-slate-900/10 border border-slate-900 border-dashed rounded-xl p-8 text-center text-slate-500 text-xs">
                            No active community reports matched your search criteria. Try removing filters.
                          </div>
                        ) : (
                          filteredIssues.map((issue) => {
                            const isSelected = selectedIssue?.id === issue.id;
                            
                            // Urgency classes
                            let urgencyBadge = 'bg-amber-950/60 border-amber-800/80 text-amber-400';
                            if (issue.urgency === 'Critical') urgencyBadge = 'bg-rose-950/60 border-rose-800/80 text-rose-400 animate-pulse';
                            else if (issue.urgency === 'High') urgencyBadge = 'bg-orange-950/60 border-orange-800/80 text-orange-400';
                            else if (issue.urgency === 'Low') urgencyBadge = 'bg-slate-900 border-slate-800 text-slate-400';

                            // Status tags
                            let statusBadge = 'bg-blue-950 text-blue-400 border border-blue-800';
                            if (issue.status === 'Resolved') statusBadge = 'bg-emerald-950 text-emerald-400 border border-emerald-800';
                            else if (issue.status === 'In Progress') statusBadge = 'bg-amber-950 text-amber-400 border border-amber-800';

                            return (
                              <div
                                key={issue.id}
                                onClick={() => setSelectedIssue(issue)}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                                  isSelected
                                    ? 'bg-slate-900 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                                    : 'bg-slate-900/40 border-slate-900 hover:border-slate-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold font-mono tracking-wide ${urgencyBadge}`}>
                                    {issue.urgency}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold font-mono ${statusBadge}`}>
                                    {issue.status}
                                  </span>
                                </div>

                                <div>
                                  <h3 className="font-bold text-xs text-slate-200 line-clamp-1 group-hover:text-emerald-400">
                                    {issue.title}
                                  </h3>
                                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                                    {issue.description}
                                  </p>
                                </div>

                                <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 font-medium">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{issue.location.address.split(',')[0]}</span>
                                  </div>
                                  {(() => {
                                    const distStr = getDistanceStr(issue.location.lat, issue.location.lng);
                                    if (distStr) {
                                      return (
                                        <span className="text-[10px] text-emerald-400 font-bold shrink-0 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                                          {distStr}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-900/60 pt-2 mt-1 text-[10px] text-slate-400">
                                  <span>{issue.category}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1 text-slate-400">
                                      <ThumbsUp className="w-3 h-3 text-slate-400" />
                                      {issue.verifiedByCount}
                                    </span>
                                    <span className="flex items-center gap-1 text-slate-400">
                                      <MessageSquare className="w-3 h-3 text-slate-400" />
                                      {issue.comments.length}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>

                    {/* Detailed Inspector panel (6 cols) */}
                    <div className="md:col-span-6">
                      {selectedIssue ? (
                        <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex flex-col gap-4">
                          
                          {/* Image of selected hazard */}
                          {selectedIssue.imageUrl && (
                            <div className="h-40 rounded-xl overflow-hidden relative border border-slate-800">
                              <img src={selectedIssue.imageUrl} className="w-full h-full object-cover" alt={selectedIssue.title} />
                              <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-slate-300 font-mono">
                                Reported photo
                              </div>
                            </div>
                          )}

                          {/* Header details */}
                          <div>
                            <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded">
                              {selectedIssue.category}
                            </span>
                            <h2 className="font-extrabold text-sm text-slate-100 mt-2 leading-snug">
                              {selectedIssue.title}
                            </h2>
                            
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-900/60 mt-3 flex flex-col gap-2">
                              <div className="flex items-start gap-1.5 text-xs text-slate-300">
                                <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  {(() => {
                                    const formatted = formatDetailedAddress(selectedIssue.location.address);
                                    return (
                                      <>
                                        <p className="font-bold text-slate-200 text-xs">
                                          {formatted.line1}
                                        </p>
                                        {formatted.line2 && (
                                          <p className="text-[11px] text-slate-400 mt-0.5">
                                            {formatted.line2}
                                          </p>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                              
                              {/* Distance, Coordinates, and Precision metrics */}
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900/80 text-[10px] font-mono text-slate-500">
                                <div>
                                  <span className="text-slate-400">LAT:</span> {selectedIssue.location.lat.toFixed(5)}
                                </div>
                                <div>
                                  <span className="text-slate-400">LNG:</span> {selectedIssue.location.lng.toFixed(5)}
                                </div>
                                {(() => {
                                  const distStr = getDistanceStr(selectedIssue.location.lat, selectedIssue.location.lng);
                                  if (distStr) {
                                    return (
                                      <div className="col-span-2 text-emerald-400 font-bold flex items-center gap-1 mt-0.5 font-sans">
                                        Proximity: {distStr}
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-900 pt-3">
                            <p className="text-[11px] font-semibold text-slate-300">Citizen Description:</p>
                            <p className="text-xs text-slate-400 leading-normal mt-1 italic">
                              "{selectedIssue.description}"
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                              <span>Reported by: {selectedIssue.reportedBy}</span>
                              <span>{new Date(selectedIssue.reportedAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          {/* Gemini AI Recommendation Engine (Glowing Blue Card) */}
                          {selectedIssue.aiAnalysis && (
                            <div className="bg-blue-950/40 border border-blue-900/70 p-3.5 rounded-xl flex flex-col gap-2 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="text-xs font-bold text-blue-200">Gemini AI Safety Action & Recommendation</span>
                              </div>
                              <p className="text-xs text-blue-300/90 leading-relaxed font-mono text-[10px]">
                                {selectedIssue.aiAnalysis}
                              </p>
                            </div>
                          )}

                          {/* Upvote Verification trigger */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleVerify(selectedIssue.id)}
                              disabled={selectedIssue.verifiedUsers.includes(userStats.userName)}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs transition-all border ${
                                selectedIssue.verifiedUsers.includes(userStats.userName)
                                  ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-emerald-500 border-emerald-400 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/10'
                              }`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {selectedIssue.verifiedUsers.includes(userStats.userName)
                                ? 'You Verified This'
                                : `Verify & Upvote Hazard (${selectedIssue.verifiedByCount})`}
                            </button>
                          </div>

                          {/* Administrative Simulator Controls (For testing life cycle states) */}
                          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-900 flex flex-col gap-2">
                            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold">
                              🛠️ Municipal Control Panel Simulator
                            </p>
                            <p className="text-[10px] text-slate-500 leading-normal">
                              Test the issue workflow progression states in real-time as a city manager or engineer:
                            </p>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              <button
                                onClick={() => handleStatusChange(selectedIssue.id, 'Verified', 'City validation check completed.')}
                                className={`text-[10px] py-1 rounded font-bold border transition-all ${
                                  selectedIssue.status === 'Verified'
                                    ? 'bg-slate-900 text-emerald-400 border-emerald-500/30'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                              >
                                State: Verified
                              </button>
                              <button
                                onClick={() => handleStatusChange(selectedIssue.id, 'In Progress', 'Municipal Maintenance Crew dispatched to repair area.')}
                                className={`text-[10px] py-1 rounded font-bold border transition-all ${
                                  selectedIssue.status === 'In Progress'
                                    ? 'bg-slate-900 text-amber-400 border-amber-500/30'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                              >
                                State: In Progress
                              </button>
                              <button
                                onClick={() => handleStatusChange(selectedIssue.id, 'Resolved', 'Repair finished. Asphalt, plumbing or lighting replaced.')}
                                className={`text-[10px] py-1 rounded font-bold border transition-all ${
                                  selectedIssue.status === 'Resolved'
                                    ? 'bg-slate-900 text-emerald-400 border-emerald-500/30'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                              >
                                State: Resolved
                              </button>
                            </div>
                          </div>

                          {/* Historical Timeline Tracker */}
                          <div>
                            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold mb-3">
                              📋 Municipal Resolution Timeline
                            </p>
                            <div className="flex flex-col gap-3 pl-2.5 border-l border-slate-800">
                              {selectedIssue.timeline.map((event, idx) => (
                                <div key={idx} className="relative">
                                  {/* Dot point indicator */}
                                  <span className="absolute -left-[14.5px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-slate-950"></span>
                                  <div className="text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-200">{event.status}</span>
                                      <span className="text-[9px] text-slate-500">
                                        {new Date(event.timestamp).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                                      {event.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Comments Section */}
                          <div className="border-t border-slate-900 pt-3">
                            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-bold mb-2">
                              💬 Citizen Comments ({selectedIssue.comments.length})
                            </p>
                            
                            <div className="flex flex-col gap-2.5 max-h-40 overflow-y-auto mb-3">
                              {selectedIssue.comments.length === 0 ? (
                                <p className="text-slate-500 text-[11px] italic">No public comments yet. Write yours below!</p>
                              ) : (
                                selectedIssue.comments.map((comment) => (
                                  <div key={comment.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-xs">
                                    <div className="flex justify-between text-[10px] text-slate-500 font-semibold mb-1">
                                      <span>{comment.userName}</span>
                                      <span>{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-slate-300 leading-normal">{comment.text}</p>
                                  </div>
                                ))
                              )}
                            </div>

                            <form onSubmit={handleAddComment} className="flex gap-2">
                              <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Add update or report notes..."
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                                required
                              />
                              <button
                                type="submit"
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-xs font-bold transition-all border border-slate-700"
                              >
                                Post
                              </button>
                            </form>
                          </div>

                        </div>
                      ) : (
                        <div className="bg-slate-900/10 border border-slate-900 border-dashed p-10 text-center text-slate-500 text-xs rounded-xl">
                          Select a reported issue from the feed to view full analytical breakdown, municipal timeline, and safety recommendations.
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: PREDICTIVE AI INSIGHTS */}
            {activeTab === 'insights' && (
              <div className="flex flex-col gap-6" id="insights-tab-view">
                <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-2xl flex flex-col sm:flex-row gap-6 items-center justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      <h2 className="text-lg font-bold tracking-tight text-slate-100">
                        Predictive Infrastructure Analysis
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Using the reports logged by citizens, Gemini AI scans clusters, correlates proximity, and analyses notes to generate proactive warnings. This helps municipal councils allocate budget and fix systematic pipeline, electric, or road failures before accidents strike.
                    </p>
                  </div>
                  <button
                    onClick={fetchInsights}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-2 shrink-0"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    Regenerate Insights
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {insights.map((insight, idx) => {
                    let sevBorder = 'border-blue-900/60 bg-blue-950/20';
                    let sevBadge = 'bg-blue-950 text-blue-400 border border-blue-800';
                    if (insight.severity === 'Urgent') {
                      sevBorder = 'border-rose-900/60 bg-rose-950/15';
                      sevBadge = 'bg-rose-950 text-rose-400 border border-rose-800';
                    } else if (insight.severity === 'Warning') {
                      sevBorder = 'border-amber-900/60 bg-amber-950/15';
                      sevBadge = 'bg-amber-950 text-amber-400 border border-amber-800';
                    }

                    return (
                      <div key={idx} className={`border p-5 rounded-2xl flex flex-col justify-between gap-4 ${sevBorder}`}>
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${sevBadge}`}>
                              {insight.severity} Priority
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold font-mono">
                              Sector: {insight.affectedArea.split('/')[0]}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-extrabold text-sm text-slate-100 mb-1 leading-snug">
                              {insight.title}
                            </h3>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {insight.description}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-slate-900/85 pt-3 mt-1 flex flex-col gap-2 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                              🔧 Actionable Mitigation
                            </p>
                            <p className="text-slate-300 leading-normal mt-0.5">
                              {insight.recommendingAction}
                            </p>
                          </div>
                          <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-900/55 text-[11px] text-emerald-400 font-medium">
                            <span className="font-bold">Eco & Safety Impact:</span> {insight.impactOfAction}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-900/20 border border-slate-900 p-5 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-200">Municipal Budget Pre-emption Impact</p>
                      <p className="text-[11px] text-slate-400">By addressing these predictions, our live community can save up to $45,000 in emergency repairs this quarter.</p>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-950 text-emerald-400 px-3 py-1 border border-emerald-900 font-semibold rounded-lg font-mono">
                    Est. Saved: $45K
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: NEIGHBORHOOD DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="dashboard-tab-view">
                
                {/* Left Side: Visual Charts & Metrics (8 cols) */}
                <div className="md:col-span-8 flex flex-col gap-6">
                  
                  {/* Category distribution visual */}
                  <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl">
                    <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                      <Filter className="w-4.5 h-4.5 text-emerald-400" />
                      Active Category Distribution (By Count)
                    </h3>

                    {stats && (
                      <div className="flex flex-col gap-4">
                        {stats.categoryDistribution.map((dist, idx) => {
                          const maxCount = Math.max(...stats.categoryDistribution.map(d => d.count), 1);
                          const pct = (dist.count / maxCount) * 100;
                          
                          let barColor = 'bg-emerald-500';
                          if (dist.category === 'Water & Leakage') barColor = 'bg-blue-500';
                          else if (dist.category === 'Roads & Potholes') barColor = 'bg-orange-500';
                          else if (dist.category === 'Waste & Sanitation') barColor = 'bg-teal-500';
                          else if (dist.category === 'Streetlights') barColor = 'bg-amber-400';

                          return (
                            <div key={idx} className="text-xs">
                              <div className="flex justify-between items-center mb-1 text-slate-300 font-medium">
                                <span>{dist.category}</span>
                                <span className="font-mono text-slate-400">{dist.count} active reports</span>
                              </div>
                              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                                <div
                                  className={`h-full ${barColor} rounded-full transition-all duration-700`}
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Citizen engagement tracker info */}
                  <div className="bg-slate-900/30 border border-slate-900 p-5 rounded-2xl">
                    <h3 className="font-bold text-slate-200 mb-2">Our Mission: Direct Local Action</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Citizen reports directly streamline dispatch processes. Rather than searching through archaic emails or calling municipal hotlines, the city council uses this command portal to view verified community issues.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-center">
                        <span className="text-2xl block mb-1">📢</span>
                        <p className="text-[11px] font-bold text-slate-300">1. Citizen Logged</p>
                        <p className="text-[10px] text-slate-500 mt-1">Issues are reported with detailed photos & geo coordinates.</p>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-center">
                        <span className="text-2xl block mb-1">🤝</span>
                        <p className="text-[11px] font-bold text-slate-300">2. Community Verified</p>
                        <p className="text-[10px] text-slate-500 mt-1">Other citizens upvote to authenticate the report urgency.</p>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-center">
                        <span className="text-2xl block mb-1">⚡</span>
                        <p className="text-[11px] font-bold text-slate-300">3. Rapid Resolution</p>
                        <p className="text-[10px] text-slate-500 mt-1">City engineers patch hazards backed by real-time validation data.</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Side: Citizen Hall of Fame / Leaderboard (4 cols) */}
                <div className="md:col-span-4 flex flex-col gap-6">
                  <div className="bg-slate-900/30 border border-slate-900 p-4 rounded-xl flex flex-col gap-4">
                    <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Award className="w-4 h-4 text-emerald-400" />
                      Active Neighborhood Contributors
                    </h3>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between bg-slate-900/70 p-2.5 rounded-lg border border-emerald-500/30">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🥇</span>
                          <div>
                            <p className="text-xs font-bold text-slate-200">{userStats.userName} (You)</p>
                            <p className="text-[9px] text-slate-400">Level {userStats.level} Sentinel • {userStats.reportsCount} Reports</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">{userStats.impactPoints} pts</span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-900/30 p-2.5 rounded-lg border border-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🥈</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Elena Rostova</p>
                            <p className="text-[9px] text-slate-500">Level 2 Contributor • 3 Reports</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">290 pts</span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-900/30 p-2.5 rounded-lg border border-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🥉</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Michael Reed</p>
                            <p className="text-[9px] text-slate-500">Level 2 Contributor • 2 Reports</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">250 pts</span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-900/30 p-2.5 rounded-lg border border-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🎖️</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Sarah Jenkins</p>
                            <p className="text-[9px] text-slate-500">Level 1 Reporter • 1 Report</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">180 pts</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </>
        )}

      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-900 mt-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Community Hero Platform. Encouraging transparency, accountability, and citizen participation.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Terms of Civic Service</span>
            <span className="hover:text-slate-400 cursor-pointer">Privacy Safeguards</span>
            <span className="hover:text-slate-400 cursor-pointer">City Council Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
