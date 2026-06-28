/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Issue } from '../types';
import { MapPin, Plus, Navigation, Info, Shield } from 'lucide-react';

interface InteractiveMapProps {
  issues: Issue[];
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue) => void;
  onPlacePin: (lat: number, lng: number, address: string) => void;
  pinLocation: { lat: number; lng: number; address: string } | null;
  isReporting: boolean;
  neighborhood?: string;
  liveLocation?: { lat: number; lng: number; address?: string } | null;
}

// Preset configuration for each neighborhood
export const NEIGHBORHOODS: Record<string, {
  centerLat: number;
  centerLng: number;
  latRange: number;
  lngRange: number;
  name: string;
  streets: string[];
  description: string;
}> = {
  'Live GPS Location': {
    centerLat: 26.4227,
    centerLng: 80.4042,
    latRange: 0.015,
    lngRange: 0.02,
    name: 'Kalyanpur, Kanpur',
    description: 'Active GPS Area with real-time hazard analytics',
    streets: ['Ashiana Avenue', 'Kalyanpur Road', 'G T Road', 'Sharda Nagar Rd', 'Indira Nagar']
  }
};

// Global Overview Bounds (Centered in Kanpur)
const GLOBAL_CENTER_LAT = 26.4227;
const GLOBAL_CENTER_LNG = 80.4042;
const GLOBAL_LAT_RANGE = 0.015;
const GLOBAL_LNG_RANGE = 0.02;

export default function InteractiveMap({
  issues,
  selectedIssue,
  onSelectIssue,
  onPlacePin,
  pinLocation,
  isReporting,
  neighborhood = 'Live GPS Location',
  liveLocation = null
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  // Update sizes responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: width || 600,
          height: Math.max(height, 380),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Is this the global zoomed-out view?
  const isGlobalView = neighborhood === 'All' || neighborhood === 'Global';

  // Get active map projection bounds
  const getBounds = () => {
    if (isGlobalView) {
      return {
        centerLat: GLOBAL_CENTER_LAT,
        centerLng: GLOBAL_CENTER_LNG,
        latRange: GLOBAL_LAT_RANGE,
        lngRange: GLOBAL_LNG_RANGE,
      };
    }
    
    // Support centering on live location
    if (neighborhood === 'Live GPS Location' && liveLocation) {
      return {
        centerLat: liveLocation.lat,
        centerLng: liveLocation.lng,
        latRange: 0.012,
        lngRange: 0.016,
      };
    }

    const cfg = NEIGHBORHOODS[neighborhood] || NEIGHBORHOODS['Live GPS Location'];
    return {
      centerLat: cfg.centerLat,
      centerLng: cfg.centerLng,
      latRange: cfg.latRange,
      lngRange: cfg.lngRange,
    };
  };

  const bounds = getBounds();

  // Convert geo-coordinates to SVG coordinate space
  const getXY = (lat: number, lng: number) => {
    const minLat = bounds.centerLat - bounds.latRange / 2;
    const maxLat = bounds.centerLat + bounds.latRange / 2;
    const minLng = bounds.centerLng - bounds.lngRange / 2;
    const maxLng = bounds.centerLng + bounds.lngRange / 2;

    const x = ((lng - minLng) / bounds.lngRange) * dimensions.width;
    const y = (1 - (lat - minLat) / bounds.latRange) * dimensions.height;
    return { x, y };
  };

  // Convert SVG coordinate space back to Geo-coordinates
  const getLatLng = (x: number, y: number) => {
    const minLat = bounds.centerLat - bounds.latRange / 2;
    const minLng = bounds.centerLng - bounds.lngRange / 2;

    const lng = minLng + (x / dimensions.width) * bounds.lngRange;
    const lat = minLat + (1 - y / dimensions.height) * bounds.latRange;
    return { lat, lng };
  };

  // Human-friendly street segment lookup based on coordinate zones
  const getStreetAddress = (lat: number, lng: number): string => {
    let activeDistrict = neighborhood;

    // If global view, determine which sub-district we clicked closest to
    if (isGlobalView) {
      let closestNbh = 'Live GPS Location';
      let minDist = Infinity;
      Object.entries(NEIGHBORHOODS).forEach(([name, cfg]) => {
        const dLat = lat - cfg.centerLat;
        const dLng = lng - cfg.centerLng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDist) {
          minDist = dist;
          closestNbh = name;
        }
      });
      activeDistrict = closestNbh;
    }

    const cfg = NEIGHBORHOODS[activeDistrict] || NEIGHBORHOODS['Live GPS Location'];
    const dLat = lat - cfg.centerLat;
    const dLng = lng - cfg.centerLng;

    let street = cfg.streets[0];
    let number = Math.floor(Math.abs(dLat * 12000)) + 120;

    // Distribute street names based on grid position relative to district center
    if (Math.abs(dLng) < 0.0035) {
      street = cfg.streets[0];
    } else if (dLng > 0.0035 && dLat > 0) {
      street = cfg.streets[1];
    } else if (dLng > 0.0035 && dLat <= 0) {
      street = cfg.streets[2];
    } else if (dLng <= -0.0035 && dLat > 0) {
      street = cfg.streets[3];
    } else {
      street = cfg.streets[4];
    }

    if (Math.abs(dLat) < 0.0018 && Math.abs(dLng) < 0.0018) {
      return `${number} Central District Plaza, ${activeDistrict}`;
    }

    return `${number} ${street}, ${activeDistrict}`;
  };

  const handleMapClick = async (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { lat, lng } = getLatLng(clickX, clickY);
    
    // Default mock address
    let address = getStreetAddress(lat, lng);

    if (neighborhood === 'Live GPS Location') {
      onPlacePin(lat, lng, 'Locating coordinates...');
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
          headers: {
            'User-Agent': 'CommunityHeroApp/1.0'
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.display_name) {
            address = data.display_name.replace(/ahiana/gi, 'Ashiana');
          } else {
            address = `Latitude ${lat.toFixed(5)}, Longitude ${lng.toFixed(5)}`;
          }
        } else {
          address = `Latitude ${lat.toFixed(5)}, Longitude ${lng.toFixed(5)}`;
        }
      } catch (err) {
        console.error('Error in click reverse geocoding:', err);
        address = `Latitude ${lat.toFixed(5)}, Longitude ${lng.toFixed(5)}`;
      }
    }

    onPlacePin(lat, lng, address);
  };

  const selectedXY = selectedIssue ? getXY(selectedIssue.location.lat, selectedIssue.location.lng) : null;
  const draftPinXY = pinLocation ? getXY(pinLocation.lat, pinLocation.lng) : null;

  return (
    <div className="relative w-full h-full min-h-[380px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex flex-col map-glow" id="map-container" ref={containerRef}>
      
      {/* Map Header with district status info */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-2 items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 flex items-center gap-2 pointer-events-auto shadow-lg text-xs font-semibold text-slate-100">
          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
          <span>District Commander View: </span>
          <span className="text-emerald-400 font-mono font-bold tracking-wide">
            {isGlobalView 
              ? 'Metro Municipality (Global)' 
              : (neighborhood === 'Live GPS Location' && liveLocation?.address) 
              ? `Live Area: ${liveLocation.address.split(',')[0].replace(/Ahiana/gi, 'Ashiana')}`
              : neighborhood}
          </span>
        </div>

        {isReporting && (
          <div className="bg-emerald-950/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/50 flex items-center gap-2 pointer-events-auto shadow-lg text-xs font-semibold text-emerald-200">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Click map area to file GPS report</span>
          </div>
        )}
      </div>

      {/* SVG Canvas Map Background */}
      <div className="relative flex-1 w-full bg-slate-950">
        <svg
          className="w-full h-full cursor-crosshair select-none"
          onClick={handleMapClick}
          style={{ minHeight: '380px' }}
          id="map-canvas-svg"
        >
          {/* Subtle grid pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.15)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* DYNAMIC BACKGROUND FEATURES PER NEIGHBORHOOD */}
          
          {/* Live GPS Location Features */}
          {neighborhood === 'Live GPS Location' && (
            <>
              {/* Kalyanpur Reserve Park */}
              <rect
                x={dimensions.width * 0.45}
                y={dimensions.height * 0.15}
                width={dimensions.width * 0.3}
                height={dimensions.height * 0.35}
                rx="12"
                className="fill-emerald-500/5 stroke-emerald-500/15"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={dimensions.width * 0.6}
                y={dimensions.height * 0.3}
                className="fill-emerald-500/40 text-[9px] font-bold tracking-widest uppercase text-center font-mono"
                dominantBaseline="middle"
                textAnchor="middle"
              >
                Kalyanpur Reserve Park
              </text>

              {/* Ganges Waterways Branch */}
              <circle
                cx={dimensions.width * 0.15}
                cy={dimensions.height * 0.75}
                r={dimensions.width * 0.08}
                className="fill-blue-500/5 stroke-blue-500/15"
                strokeWidth="1"
              />
              <text
                x={dimensions.width * 0.15}
                y={dimensions.height * 0.75}
                className="fill-blue-500/40 text-[9px] font-bold tracking-widest uppercase text-center font-mono"
                dominantBaseline="middle"
                textAnchor="middle"
              >
                Ganges Waterways Branch
              </text>

              {/* Streets */}
              <line x1={dimensions.width * 0.5} y1={0} x2={dimensions.width * 0.5} y2={dimensions.height} className="stroke-slate-800/80" strokeWidth="12" strokeLinecap="round" />
              <line x1={dimensions.width * 0.5} y1={dimensions.height * 0.3} x2={dimensions.width} y2={dimensions.height * 0.3} className="stroke-slate-800/50" strokeWidth="8" strokeLinecap="round" />
              <line x1={dimensions.width * 0.5} y1={dimensions.height * 0.65} x2={dimensions.width} y2={dimensions.height * 0.65} className="stroke-slate-800/40" strokeWidth="8" strokeLinecap="round" />
              <line x1={0} y1={dimensions.height * 0.45} x2={dimensions.width * 0.5} y2={dimensions.height * 0.45} className="stroke-slate-800/50" strokeWidth="8" strokeLinecap="round" />

              <text x={dimensions.width * 0.53} y={dimensions.height * 0.85} className="fill-slate-500 text-[8px] font-bold font-mono uppercase tracking-widest">Kalyanpur Road</text>
              <text x={dimensions.width * 0.7} y={dimensions.height * 0.25} className="fill-slate-600 text-[8px] font-bold font-mono uppercase tracking-widest">Ashiana Avenue</text>
              <text x={dimensions.width * 0.7} y={dimensions.height * 0.6} className="fill-slate-600 text-[8px] font-bold font-mono uppercase tracking-widest">G T Road</text>
              <text x={dimensions.width * 0.15} y={dimensions.height * 0.4} className="fill-slate-600 text-[8px] font-bold font-mono uppercase tracking-widest">Sharda Nagar Rd</text>
            </>
          )}

          {/* Draw Existing Issues as color-coded interactive markers */}
          {issues.map((issue) => {
            const { x, y } = getXY(issue.location.lat, issue.location.lng);
            const isSelected = selectedIssue?.id === issue.id;

            // Skip drawing if coordinates fall off the canvas
            if (x < 0 || x > dimensions.width || y < 0 || y > dimensions.height) {
              return null;
            }

            // Urgency color scheme
            let markerColor = 'fill-amber-500';
            let pulseColor = 'text-amber-500';
            if (issue.urgency === 'Critical') {
              markerColor = 'fill-rose-500';
              pulseColor = 'text-rose-500';
            } else if (issue.urgency === 'High') {
              markerColor = 'fill-orange-500';
              pulseColor = 'text-orange-500';
            } else if (issue.status === 'Resolved') {
              markerColor = 'fill-emerald-500';
              pulseColor = 'text-emerald-500';
            } else if (issue.category === 'Water & Leakage') {
              markerColor = 'fill-blue-500';
              pulseColor = 'text-blue-500';
            }

            return (
              <g
                key={issue.id}
                className="cursor-pointer group transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectIssue(issue);
                }}
              >
                {/* Outer halo */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 18 : 10}
                  className="fill-slate-800/50 stroke-slate-700/60 transition-all duration-300 group-hover:scale-125"
                  strokeWidth="1.5"
                />

                {/* Animated Ping Ring for active/critical hazards */}
                {issue.status !== 'Resolved' && (
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 14 : 8}
                    className={`fill-none stroke-current opacity-75 animate-ping ${pulseColor}`}
                    strokeWidth="1.5"
                  />
                )}

                {/* Inner Pin Dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 6.5 : 4.5}
                  className={`${markerColor} transition-all duration-300`}
                />
              </g>
            );
          })}

          {/* Selected Issue Target highlight */}
          {selectedXY && selectedXY.x >= 0 && selectedXY.x <= dimensions.width && selectedXY.y >= 0 && selectedXY.y <= dimensions.height && (
            <g className="pointer-events-none">
              <circle
                cx={selectedXY.x}
                cy={selectedXY.y}
                r="24"
                className="fill-none stroke-emerald-400/50 stroke-2 animate-pulse"
                strokeDasharray="3 3"
              />
              <path
                d={`M ${selectedXY.x} ${selectedXY.y - 26} L ${selectedXY.x} ${selectedXY.y - 10}`}
                className="stroke-emerald-400"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* Draft New Report Pin */}
          {draftPinXY && draftPinXY.x >= 0 && draftPinXY.x <= dimensions.width && draftPinXY.y >= 0 && draftPinXY.y <= dimensions.height && (
            <g className="pointer-events-none transition-all duration-300 animate-bounce">
              <circle
                cx={draftPinXY.x}
                cy={draftPinXY.y}
                r="16"
                className="fill-none stroke-emerald-400/70 stroke-2 animate-ping"
              />
              <g transform={`translate(${draftPinXY.x - 12}, ${draftPinXY.y - 28})`}>
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  className="fill-emerald-400 drop-shadow-md"
                />
              </g>
            </g>
          )}

          {/* Live User Location Pinpoint */}
          {liveLocation && (() => {
            const liveXY = getXY(liveLocation.lat, liveLocation.lng);
            if (liveXY.x >= 0 && liveXY.x <= dimensions.width && liveXY.y >= 0 && liveXY.y <= dimensions.height) {
              return (
                <g className="pointer-events-none">
                  {/* Outer pulsating radar ring */}
                  <circle
                    cx={liveXY.x}
                    cy={liveXY.y}
                    r="18"
                    className="fill-none stroke-blue-400/50 stroke-2 animate-ping"
                  />
                  {/* Satellite aura */}
                  <circle
                    cx={liveXY.x}
                    cy={liveXY.y}
                    r="10"
                    className="fill-blue-500/10 stroke-blue-500/25 stroke-1"
                  />
                  {/* Hard anchor dot */}
                  <circle
                    cx={liveXY.x}
                    cy={liveXY.y}
                    r="6.5"
                    className="fill-blue-500 stroke-slate-900 stroke-2"
                  />
                  <circle
                    cx={liveXY.x}
                    cy={liveXY.y}
                    r="2"
                    className="fill-white"
                  />
                  {/* Floating User Label */}
                  <g transform={`translate(${liveXY.x - 30}, ${liveXY.y - 25})`}>
                    <rect
                      width="60"
                      height="13"
                      rx="3.5"
                      className="fill-blue-950/95 stroke-blue-500/40"
                      strokeWidth="1"
                    />
                    <text
                      x="30"
                      y="7.5"
                      className="fill-blue-300 text-[6.5px] font-black font-mono tracking-wider text-center"
                      dominantBaseline="middle"
                      textAnchor="middle"
                    >
                      YOU (LIVE)
                    </text>
                  </g>
                </g>
              );
            }
            return null;
          })()}
        </svg>

        {/* Legend bar at bottom */}
        <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800/80 flex flex-wrap gap-x-4 gap-y-2 items-center justify-between text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Critical Urgency
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"></span>
              High / Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              Water & Leakage
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Resolved
            </span>
            {pinLocation && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold">
                <MapPin className="w-3.5 h-3.5" />
                Placed: {pinLocation.address.split(',')[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
            <Info className="w-3 h-3 text-slate-500" />
            <span>Click to select issues or place coordinates pin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
