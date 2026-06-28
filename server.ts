/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';

dotenv.config();

// Initialize Gemini SDK with telemetry header and key format verification
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

const isValidApiKey = (key: string | undefined): boolean => {
  if (!key) return false;
  const k = key.trim();
  // Standard Google/Gemini API keys are expected to start with 'AIza'
  return k.startsWith('AIza') && k.length > 10;
};

if (isValidApiKey(geminiApiKey)) {
  try {
    ai = new GoogleGenAI({
      apiKey: geminiApiKey!.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini API initialized successfully with valid API key format.');
  } catch (error) {
    console.error('Failed to initialize Gemini API:', error);
  }
} else {
  console.warn('GEMINI_API_KEY is missing, empty, or does not have a valid format (must start with "AIza"). AI features will fallback to curated mock responses.');
}

// AI rate-limiting throttling state to prevent spamming exhausted quota
let isQuotaExhausted = false;
let quotaResetTime = 0;

// In-memory cache for neighborhood predictive insights (prevents hitting API limits repeatedly)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const insightsCache: Record<string, CacheEntry> = {};
const INSIGHTS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

function handleGeminiError(error: any) {
  const errStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
  const is429 = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('quota') || (error?.status === 429) || (error?.code === 429);
  
  if (is429) {
    isQuotaExhausted = true;
    quotaResetTime = Date.now() + 5 * 60 * 1000; // Throttled for 5 minutes
    console.warn(`[GEMINI API 429] Quota exceeded. Activating self-healing AI throttle for 5 minutes.`);
  } else {
    console.error('Gemini API Error occurred:', error);
  }
}

// Robust JSON extractor and cleaner for Gemini responses
function cleanAndParseJson(text: string): any {
  if (!text) throw new Error('Empty text response received');
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));

// Shared Types inlined / defined
interface Comment {
  id: string;
  userName: string;
  text: string;
  timestamp: string;
}

interface TimelineEvent {
  status: 'Reported' | 'Verified' | 'In Progress' | 'Resolved';
  description: string;
  timestamp: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  category: 'Roads & Potholes' | 'Water & Leakage' | 'Waste & Sanitation' | 'Streetlights' | 'Public Facilities' | 'Others';
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Reported' | 'Verified' | 'In Progress' | 'Resolved';
  neighborhood: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  reportedBy: string;
  reportedAt: string;
  verifiedByCount: number;
  verifiedUsers: string[];
  imageUrl?: string;
  comments: Comment[];
  estimatedDaysToResolve: number;
  aiAnalysis?: string;
  timeline: TimelineEvent[];
}

// In-memory Database with realistic community issue reports across multiple districts
let issues: Issue[] = [
  {
    id: '1',
    title: 'Major Active Water Leakage & Flooding',
    description: 'A large underground water pipe has burst near Elm Street Park entrance. Water is actively gushing onto the road, creating a massive puddle and hazard for vehicles and pedestrians. The water pressure seems very high, and it is washing away gravel onto the sidewalk.',
    category: 'Water & Leakage',
    urgency: 'Critical',
    status: 'In Progress',
    neighborhood: 'Oakwood Heights',
    location: {
      lat: 37.7765,
      lng: -122.4182,
      address: '750 Elm Street (near Elm Street Park Entrance), Oakwood Heights'
    },
    reportedBy: 'Sarah Jenkins',
    reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    verifiedByCount: 14,
    verifiedUsers: ['sarah_j', 'mike_r', 'alicia_k', 'david_p', 'john_d'],
    imageUrl: 'https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 2,
    aiAnalysis: 'AI CLASSIFICATION: This water main leakage is categorized as CRITICAL due to active flooding, clean water waste, and road hazard risks. Safety Action: Avoid walking through the flow as underground erosion could cause sinkholes. Recommended remediation: Immediate water utility shutdown, followed by excavation and pipe joint replacement.',
    timeline: [
      {
        status: 'Reported',
        description: 'Issue reported by Sarah Jenkins via Mobile App. Initial AI analysis triggered.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Verified',
        description: 'Community verification threshold exceeded. Local residents confirmed the burst pipe.',
        timestamp: new Date(Date.now() - 1.8 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'In Progress',
        description: 'Municipal Water Department has dispatched a repair crew. Water line isolated.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: [
      {
        id: 'c1',
        userName: 'Michael Reed',
        text: 'Drove past this morning, the lane is partially blocked but the city crew is on-site setting up cones.',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'c2',
        userName: 'Elena Rostova',
        text: 'The water pressure in the nearby buildings has dropped. Hope they fix this soon!',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: '2',
    title: 'Deep Multi-Vehicle Pothole Hazard',
    description: 'A very deep and wide pothole has opened up on Maple Avenue, right after the intersection with 4th Street. It is hard to see at night and several cars have suffered blown tires already. It is about 8 inches deep and exposes the underlying rebar.',
    category: 'Roads & Potholes',
    urgency: 'High',
    status: 'Verified',
    neighborhood: 'Oakwood Heights',
    location: {
      lat: 37.7738,
      lng: -122.4215,
      address: '420 Maple Avenue, Oakwood Heights'
    },
    reportedBy: 'Carlos Mendoza',
    reportedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    verifiedByCount: 9,
    verifiedUsers: ['carlos_m', 'tim_b', 'linda_s'],
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 4,
    aiAnalysis: 'AI CLASSIFICATION: This pothole is classified as HIGH urgency because of its depth (8 inches) and location in a high-speed transit lane. Risk: Structural vehicle damage and sudden swerving. Remediation recommended: Immediate cold-mix asphalt filling as a temporary safeguard, followed by full sub-base compaction and hot asphalt patching.',
    timeline: [
      {
        status: 'Reported',
        description: 'Issue reported by Carlos Mendoza. Image upload scanned by Gemini AI.',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Verified',
        description: 'Verified by 9 community members. Urgency confirmed as High.',
        timestamp: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: [
      {
        id: 'c3',
        userName: 'Tim Baker',
        text: 'Almost hit this last night. It is extremely dangerous because there are no streetlights right above it.',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: '3',
    title: 'Unlit Pedestrian Crossing (Damaged Streetlight)',
    description: 'The street lamp illuminating the pedestrian crosswalk on Pine Road is completely dark. The pole base looks like it was clipped by a vehicle, causing the access door to pop open and wires to be exposed. Pedestrians crossing at night are practically invisible.',
    category: 'Streetlights',
    urgency: 'High',
    status: 'Reported',
    neighborhood: 'Oakwood Heights',
    location: {
      lat: 37.7751,
      lng: -122.4230,
      address: 'Pine Road & 5th Avenue Intersection, Oakwood Heights'
    },
    reportedBy: 'Jessica Taylor',
    reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    verifiedByCount: 4,
    verifiedUsers: ['jess_t', 'mark_l'],
    imageUrl: 'https://images.unsplash.com/photo-1509024644558-2f56ce76c490?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 3,
    aiAnalysis: 'AI CLASSIFICATION: Categorized as HIGH urgency due to physical vehicle damage to the pole base, exposed wiring, and the safety threat to pedestrians in an unlit crosswalk. Action: Avoid touching the exposed wires at the pole base. Recommended remediation: Emergency electrical isolation, structural pole inspection, and bulb/ballast replacement.',
    timeline: [
      {
        status: 'Reported',
        description: 'Issue reported by Jessica Taylor. AI suggested high urgency due to electrical hazard.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: []
  },
  {
    id: '4',
    title: 'Illegal Waste Dumping Behind Community Center',
    description: 'Someone dumped several old mattresses, multiple cans of leftover chemical paint, building drywall, and household electronics in the alleyway right behind the Oakwood Community Center. It is attracting rodents and blocks the fire exit.',
    category: 'Waste & Sanitation',
    urgency: 'Medium',
    status: 'Resolved',
    neighborhood: 'Oakwood Heights',
    location: {
      lat: 37.7722,
      lng: -122.4168,
      address: 'Alleyway behind 120 Oakwood Blvd, Oakwood Heights'
    },
    reportedBy: 'Robert Chen',
    reportedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    verifiedByCount: 12,
    verifiedUsers: ['rob_c', 'alice_w', 'dave_y'],
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 5,
    aiAnalysis: 'AI CLASSIFICATION: Waste & Sanitation issue, urgency MEDIUM. Paint canisters represent a potential hazardous chemical runoff. Fire exit block is an immediate safety concern. Action: City sanitation must dispatch a hazmat collection vehicle. Recommended community action: Request surveillance installation or neighborhood patrol to prevent repeat dumping.',
    timeline: [
      {
        status: 'Reported',
        description: 'Illegal dumping reported by Robert Chen.',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Verified',
        description: 'Verified by community. Upvotes reached high numbers. Local health concern noted.',
        timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'In Progress',
        description: 'Sanitation hazard unit scheduled for pickup. Fire department notified of exit obstruction.',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Resolved',
        description: 'City Sanitation cleaned the alley. Mattresses and chemical paint disposed of correctly. Exit cleared.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: [
      {
        id: 'c4',
        userName: 'Alice Wong',
        text: 'The alley is fully clean now! Big thanks to the sanitation team and everyone who verified this.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: '5',
    title: 'Severely Broken swing set in Children Park',
    description: 'The support chains on two of the swings in the Childrens playground at Oakwood Park are completely rusted through and one has snapped, leaving the swing hanging dangerously. Children are still trying to play on it.',
    category: 'Public Facilities',
    urgency: 'Medium',
    status: 'Reported',
    neighborhood: 'Oakwood Heights',
    location: {
      lat: 37.7780,
      lng: -122.4150,
      address: 'Oakwood Childrens Playground, Oakwood Heights'
    },
    reportedBy: 'Aris Thorne',
    reportedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    verifiedByCount: 2,
    verifiedUsers: ['aris_t', 'john_m'],
    imageUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 5,
    aiAnalysis: 'AI CLASSIFICATION: Public Facilities safety hazard, urgency MEDIUM. Active danger of children falling or being struck by the dangling chains. Recommended remediation: Tape off the swing set immediately, remove damaged swings, and install commercial-grade galvanized steel chains and heavy-duty polymer swing seats.',
    timeline: [
      {
        status: 'Reported',
        description: 'Issue reported by Aris Thorne. Safety flags raised.',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: [
      {
        id: 'c5',
        userName: 'John Miller',
        text: 'I tied a warning ribbon around it to stop the toddlers from trying to climb it. We need the city to replace the chains!',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: '6',
    title: 'Clogged Drainage & Waterfront Flooding',
    description: 'During peak high tide and rainfall, the storm drainage outlet near Riverbend Marina is completely clogged with river sediment and organic waste. Water is flooding the pedestrian pathway and cycle corridor.',
    category: 'Water & Leakage',
    urgency: 'High',
    status: 'Reported',
    neighborhood: 'Riverbend District',
    location: {
      lat: 37.7915,
      lng: -122.3995,
      address: '180 River Road, Riverbend District'
    },
    reportedBy: 'Marcus Vance',
    reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    verifiedByCount: 3,
    verifiedUsers: ['marcus_v', 'lina_v'],
    imageUrl: 'https://images.unsplash.com/photo-1542060748-10c28b629f6f?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 3,
    aiAnalysis: 'AI CLASSIFICATION: Blocked drainage outlet causing minor shoreline inundation. Urgency HIGH because of recreational trail flooding and cyclists slip risk. Recommended remediation: Deploy municipal vacuum truck to clear organic choke point and install automated high-tide reflux valve.',
    timeline: [
      {
        status: 'Reported',
        description: 'Inundation reported by Marcus Vance.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: []
  },
  {
    id: '7',
    title: 'Piles of Commercial Trash Behind Fish Market',
    description: 'Several wooden crates of spoiled seafood, waste cardboard, and broken plastic containers have been stacked in the alley behind the market, entirely blocking pedestrian access and attracting harbor birds and rats.',
    category: 'Waste & Sanitation',
    urgency: 'Medium',
    status: 'In Progress',
    neighborhood: 'Riverbend District',
    location: {
      lat: 37.7890,
      lng: -122.4025,
      address: '90 Dock Street, Riverbend District'
    },
    reportedBy: 'Lina Vance',
    reportedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    verifiedByCount: 8,
    verifiedUsers: ['lina_v', 'marcus_v', 'sam_t'],
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 2,
    aiAnalysis: 'AI CLASSIFICATION: Severe bio-waste dumping in commercial corridor. Urgency MEDIUM, but poses high pest vector risk. Remediation: Immediate Sanitation Department dispatch for heavy cleanup, issue commercial warning to neighboring market operators.',
    timeline: [
      {
        status: 'Reported',
        description: 'Dumping logged by Lina Vance.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Verified',
        description: 'Verified by local store owners.',
        timestamp: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'In Progress',
        description: 'Sanitation dispatch scheduled for early morning sweep.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: []
  },
  {
    id: '8',
    title: 'Landslide Mud & Rockfall on Ridge Road',
    description: 'A minor slope collapse from the cliff side has dumped heavy gravel, clay mud, and large jagged rocks onto Ridge Road on a blind curve. Driving around the obstacle requires crossing into oncoming traffic lanes.',
    category: 'Roads & Potholes',
    urgency: 'Critical',
    status: 'Verified',
    neighborhood: 'Pinecrest Hills',
    location: {
      lat: 37.7538,
      lng: -122.4415,
      address: '1200 Ridge Road, Pinecrest Hills'
    },
    reportedBy: 'Diana Prince',
    reportedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
    verifiedByCount: 11,
    verifiedUsers: ['diana_p', 'clark_k', 'bruce_w'],
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 2,
    aiAnalysis: 'AI CLASSIFICATION: Active road obstruction on major transit road. Urgency CRITICAL due to vehicle collision and blind corner swerving risks. Recommendations: Dispatch emergency bulldozer crew, install temporary warning pylons, and evaluate hillside retaining wire mesh.',
    timeline: [
      {
        status: 'Reported',
        description: 'Obstruction reported by Diana Prince.',
        timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Verified',
        description: 'Critical threshold met. Confirmed as primary road hazard.',
        timestamp: new Date(Date.now() - 1.2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: []
  },
  {
    id: '9',
    title: 'Complete Blackout on Summit Path Corridor',
    description: 'An entire section of five consecutive street lamps along Summit Path is completely unlit. The circuit seems to have tripped after yesterday’s thunderstorm, leaving the winding road in pitch blackness.',
    category: 'Streetlights',
    urgency: 'High',
    status: 'Reported',
    neighborhood: 'Pinecrest Hills',
    location: {
      lat: 37.7562,
      lng: -122.4385,
      address: 'Summit Path & Valley View, Pinecrest Hills'
    },
    reportedBy: 'Ethan Hunt',
    reportedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    verifiedByCount: 2,
    verifiedUsers: ['ethan_h', 'luther_s'],
    imageUrl: 'https://images.unsplash.com/photo-1509024644558-2f56ce76c490?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 2,
    aiAnalysis: 'AI CLASSIFICATION: Multi-pole illumination circuit failure. Urgency HIGH due to winding hilly geography and zero peripheral lighting for vehicles or hikers. Action: Municipal electric team must inspect transformer box #B4.',
    timeline: [
      {
        status: 'Reported',
        description: 'Electrical blackout logged by Ethan Hunt.',
        timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: []
  },
  {
    id: '10',
    title: 'Shattered Overhead Glass Canopy at Transit Station',
    description: 'One of the tempered glass overhead panels on the main transit shelter has been cracked and shattered by high winds or vandalism. Heavy glass shards are dangling precariously and could fall on waiting passengers.',
    category: 'Public Facilities',
    urgency: 'High',
    status: 'Verified',
    neighborhood: 'Metro Center',
    location: {
      lat: 37.7865,
      lng: -122.4085,
      address: 'Broadway Transit Shelter, Metro Center'
    },
    reportedBy: 'Clara Oswald',
    reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    verifiedByCount: 6,
    verifiedUsers: ['clara_o', 'danny_p', 'pink_d'],
    imageUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 3,
    aiAnalysis: 'AI CLASSIFICATION: Shattered overhead glazing on civic property. Urgency HIGH due to overhead structural threat to transit users. Action: Safe cordon set up, remove cracked glass elements, install polycarbonate alternative.',
    timeline: [
      {
        status: 'Reported',
        description: 'Vandalism/glass hazard reported by Clara Oswald.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Verified',
        description: 'Verified by community commuters.',
        timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: []
  },
  {
    id: '11',
    title: 'Fountain Defacement in Central Plaza',
    description: 'The historic stone fountain in Central Plaza has been heavily defaced with spray paint. The main water basin is also choked with plastic wrappers and the filtration pump has seized up.',
    category: 'Public Facilities',
    urgency: 'Low',
    status: 'Resolved',
    neighborhood: 'Metro Center',
    location: {
      lat: 37.7838,
      lng: -122.4115,
      address: 'Central Plaza Fountain, Metro Center'
    },
    reportedBy: 'Bruce Wayne',
    reportedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    verifiedByCount: 15,
    verifiedUsers: ['bruce_w', 'alfred_p', 'lucius_f'],
    imageUrl: 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&q=80&w=800',
    estimatedDaysToResolve: 4,
    aiAnalysis: 'AI CLASSIFICATION: Defacement and system clogging of municipal park feature. Urgency LOW as there is no immediate bodily threat. Action: Paint blasting, filter pump extraction, and water replenishment.',
    timeline: [
      {
        status: 'Reported',
        description: 'Fountain damage reported by Bruce Wayne.',
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Verified',
        description: 'Verified by community members.',
        timestamp: new Date(Date.now() - 7.5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'In Progress',
        description: 'Public Works scheduled sandblasting crew.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        status: 'Resolved',
        description: 'Fountain cleared of paint and trash, water pump motor replaced and fully functional.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    comments: []
  }
];

// Dynamically translate all seeded issues to center on Kalyanpur, Kanpur under "Live GPS Location"
const OLD_CENTER_LAT = 37.7749;
const OLD_CENTER_LNG = -122.4194;
const NEW_CENTER_LAT = 26.4227;
const NEW_CENTER_LNG = 80.4042;

issues = issues.map(issue => {
  let dLat = issue.location.lat - OLD_CENTER_LAT;
  let dLng = issue.location.lng - OLD_CENTER_LNG;

  // Keep issues clustered tightly within our Kalyanpur map projection bounds
  if (Math.abs(dLat) > 0.04 || Math.abs(dLng) > 0.04) {
    dLat = (Math.random() - 0.5) * 0.012;
    dLng = (Math.random() - 0.5) * 0.016;
  }

  const newLat = NEW_CENTER_LAT + dLat;
  const newLng = NEW_CENTER_LNG + dLng;

  let newAddress = issue.location.address || '';
  newAddress = newAddress.replace(/Oakwood Heights/gi, 'Kalyanpur, Kanpur');
  newAddress = newAddress.replace(/Riverbend District/gi, 'Kalyanpur, Kanpur');
  newAddress = newAddress.replace(/Pinecrest Hills/gi, 'Kalyanpur, Kanpur');
  newAddress = newAddress.replace(/Metro Center/gi, 'Kalyanpur, Kanpur');
  newAddress = newAddress.replace(/Elm Street/gi, 'Ashiana Avenue');
  newAddress = newAddress.replace(/Maple Avenue/gi, 'Kalyanpur Road');
  newAddress = newAddress.replace(/Pine Road/gi, 'G T Road');
  newAddress = newAddress.replace(/Broadway Plaza/gi, 'Sharda Nagar Rd');

  return {
    ...issue,
    neighborhood: 'Live GPS Location',
    location: {
      ...issue.location,
      lat: Number(newLat.toFixed(5)),
      lng: Number(newLng.toFixed(5)),
      address: newAddress
    }
  };
});

// Helper to calculate statistics filtered by neighborhood
function getStatistics(neighborhood?: string) {
  const filteredIssues = (neighborhood && neighborhood !== 'All' && neighborhood !== 'Global')
    ? issues.filter(i => i.neighborhood === neighborhood)
    : issues;

  const total = filteredIssues.length;
  const resolved = filteredIssues.filter(i => i.status === 'Resolved').length;
  const active = total - resolved;
  const critical = filteredIssues.filter(i => i.urgency === 'Critical' && i.status !== 'Resolved').length;
  
  // Calculate average resolution time for resolved issues
  const resolvedIssuesList = filteredIssues.filter(i => i.status === 'Resolved');
  let avgResolutionTimeDays = 3; // Default default
  if (resolvedIssuesList.length > 0) {
    let totalDays = 0;
    resolvedIssuesList.forEach(issue => {
      const reportDate = new Date(issue.reportedAt).getTime();
      const resolvedEvent = issue.timeline.find(t => t.status === 'Resolved');
      if (resolvedEvent) {
        const resolvedDate = new Date(resolvedEvent.timestamp).getTime();
        totalDays += (resolvedDate - reportDate) / (1000 * 60 * 60 * 24);
      } else {
        totalDays += 5; // Fallback
      }
    });
    avgResolutionTimeDays = Math.round((totalDays / resolvedIssuesList.length) * 10) / 10;
  }

  // Calculate category distribution
  const categories: Record<string, number> = {
    'Roads & Potholes': 0,
    'Water & Leakage': 0,
    'Waste & Sanitation': 0,
    'Streetlights': 0,
    'Public Facilities': 0,
    'Others': 0,
  };
  filteredIssues.forEach(i => {
    if (categories[i.category] !== undefined) {
      categories[i.category]++;
    } else {
      categories['Others']++;
    }
  });

  const categoryDistribution = Object.keys(categories).map(cat => ({
    category: cat,
    count: categories[cat]
  }));

  // Arbitrary gamified point calculation
  const impactPointsSaved = resolved * 150 + filteredIssues.reduce((acc, issue) => acc + (issue.verifiedByCount * 10), 0);

  return {
    totalIssues: total,
    resolvedIssues: resolved,
    activeIssues: active,
    criticalIssues: critical,
    avgResolutionTimeDays,
    categoryDistribution,
    impactPointsSaved,
  };
}

// Simple user store
interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  userName: string;
  stats: any; // UserStats
}

const USERS_FILE = path.join(process.cwd(), 'users.json');

// Helper to hash password
const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

let users: UserRecord[] = [];

// Seed default user Alvin Rex
const seedUsers = () => {
  const alvinStats = {
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

  users = [
    {
      id: 'alvin-rex-id',
      email: 'alvin21oct2005@gmail.com',
      passwordHash: hashPassword('password123'),
      userName: 'Alvin Rex',
      stats: alvinStats
    }
  ];
};

// Try to load users from users.json, fallback to seed
try {
  if (fs.existsSync(USERS_FILE)) {
    const fileData = fs.readFileSync(USERS_FILE, 'utf-8');
    users = JSON.parse(fileData);
    console.log(`Loaded ${users.length} users from users.json`);
  } else {
    seedUsers();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    console.log('Seeded users and created users.json');
  }
} catch (err) {
  console.error('Failed to manage users.json file, utilizing in-memory users list.', err);
  seedUsers();
}

// Save helper
const saveUsersToFile = () => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save users to file:', err);
  }
};

// REST API Endpoints

// Authentication Endpoints

// Sign Up
app.post('/api/auth/signup', (req, res) => {
  try {
    const { email, password, userName } = req.body;
    if (!email || !password || !userName) {
      return res.status(400).json({ error: 'All fields (email, password, and username) are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedUsername = userName.trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    // Check duplicates
    const emailExists = users.some(u => u.email.toLowerCase() === normalizedEmail);
    if (emailExists) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const usernameExists = users.some(u => u.userName.toLowerCase() === trimmedUsername.toLowerCase());
    if (usernameExists) {
      return res.status(400).json({ error: 'This username is already taken.' });
    }

    // Create new user record
    const newId = 'user_' + Math.random().toString(36).substring(2, 11);
    const initialStats = {
      userName: trimmedUsername,
      level: 1,
      xp: 50, // Welcome bonus
      badges: [
        { id: 'welcome', title: 'New Citizen', description: 'Joined the Community Hero Network', icon: '✨', unlockedAt: new Date().toISOString() }
      ],
      reportsCount: 0,
      verificationsCount: 0,
      impactPoints: 50
    };

    const newUser: UserRecord = {
      id: newId,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      userName: trimmedUsername,
      stats: initialStats
    };

    users.push(newUser);
    saveUsersToFile();

    return res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        userName: newUser.userName,
        stats: newUser.stats
      },
      token: `mock_token_${newUser.id}`
    });
  } catch (error) {
    console.error('Error during signup:', error);
    return res.status(500).json({ error: 'An internal error occurred during signup.' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = hashPassword(password);

    const user = users.find(u => u.email.toLowerCase() === normalizedEmail && u.passwordHash === passwordHash);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        stats: user.stats
      },
      token: `mock_token_${user.id}`
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'An internal error occurred during login.' });
  }
});

// Sync/Update User Stats
app.post('/api/auth/update-stats', (req, res) => {
  try {
    const { userName, stats } = req.body;
    if (!userName || !stats) {
      return res.status(400).json({ error: 'Username and stats are required.' });
    }

    const userIndex = users.findIndex(u => u.userName.toLowerCase() === userName.toLowerCase());
    if (userIndex !== -1) {
      users[userIndex].stats = stats;
      saveUsersToFile();
      return res.json({ success: true, stats: users[userIndex].stats });
    }

    return res.status(404).json({ error: 'User not found.' });
  } catch (error) {
    console.error('Error updating stats:', error);
    return res.status(500).json({ error: 'Failed to synchronize user stats.' });
  }
});

// 1. Get all issues (supporting neighborhood filter query parameter)
app.get('/api/issues', (req, res) => {
  const { neighborhood } = req.query;
  if (neighborhood && neighborhood !== 'All' && neighborhood !== 'Global') {
    const filtered = issues.filter(i => i.neighborhood === neighborhood);
    return res.json(filtered);
  }
  res.json(issues);
});

// 2. Get dashboard stats (supporting neighborhood filter query parameter)
app.get('/api/stats', (req, res) => {
  const { neighborhood } = req.query;
  const stats = getStatistics(neighborhood as string);
  res.json(stats);
});

// 3. Create a new issue (AI-Assisted)
app.post('/api/issues', async (req, res) => {
  try {
    const { title, description, category, urgency, location, imageUrl, reportedBy, neighborhood } = req.body;

    if (!description || !location || !location.address) {
      return res.status(400).json({ error: 'Description and location are required.' });
    }

    const finalNeighborhood = neighborhood || 'Live GPS Location';

    // Default values if AI fails or isn't configured
    let finalTitle = title || 'Community Issue Report';
    let finalCategory = category || 'Others';
    let finalUrgency = urgency || 'Medium';
    let finalEstimatedDays = 5;
    let finalAiAnalysis = 'AI Classification: Standard Issue. Initial review pending municipal dispatch.';

    // If Gemini SDK is available and not throttled, perform rich analysis
    const now = Date.now();
    if (ai && !(isQuotaExhausted && now < quotaResetTime)) {
      try {
        console.log('Sending report to Gemini for automated categorization and analysis...');
        
        let promptText = `Analyze this community issue report and categorize it accurately.
        Description: "${description}"
        User Suggested Title: "${title || 'None'}"
        User Suggested Category: "${category || 'None'}"
        User Suggested Urgency: "${urgency || 'None'}"
        Neighborhood: "${finalNeighborhood}"
        
        Provide:
        1. A refined, professional, and clear Title (max 10 words).
        2. Category, which must be EXACTLY one of: "Roads & Potholes", "Water & Leakage", "Waste & Sanitation", "Streetlights", "Public Facilities", "Others".
        3. Urgency, which must be EXACTLY one of: "Low", "Medium", "High", "Critical".
        4. Estimated resolution time (in days, as an integer).
        5. A comprehensive safety recommendation and technical analysis (max 100 words). Starts with "AI CLASSIFICATION: ..."`;

        let contentsPayload: any = { parts: [{ text: promptText }] };

        // If there's an image base64, send it as multimodal
        if (imageUrl && imageUrl.startsWith('data:image')) {
          const base64Parts = imageUrl.split(';base64,');
          if (base64Parts.length === 2) {
            const mimeType = base64Parts[0].split('data:')[1];
            const base64Data = base64Parts[1];
            
            // Re-structure payload for multimodal content
            contentsPayload = {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                },
                {
                  text: promptText + `\n\nAlso consider the attached image of the issue to determine details (e.g. estimate severity, verify the hazard, etc.).`
                }
              ]
            };
            console.log('Including image in Gemini analysis...');
          }
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: contentsPayload,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Refined short title' },
                category: { type: Type.STRING, description: 'Exact matching category string' },
                urgency: { type: Type.STRING, description: 'Exact matching urgency level' },
                estimatedDaysToResolve: { type: Type.INTEGER, description: 'Typical resolution days' },
                aiAnalysis: { type: Type.STRING, description: 'Analysis and safety precautions, max 100 words' }
              },
              required: ['title', 'category', 'urgency', 'estimatedDaysToResolve', 'aiAnalysis']
            }
          }
        });

        const rawText = response.text;
        if (rawText) {
          const parsed = cleanAndParseJson(rawText);
          console.log('Gemini returned analysis:', parsed);
          
          if (parsed.title) finalTitle = parsed.title;
          if (parsed.category) finalCategory = parsed.category;
          if (parsed.urgency) finalUrgency = parsed.urgency;
          if (parsed.estimatedDaysToResolve) finalEstimatedDays = parsed.estimatedDaysToResolve;
          if (parsed.aiAnalysis) finalAiAnalysis = parsed.aiAnalysis;
        }
      } catch (aiErr) {
        console.warn('Gemini API analysis failed. Falling back to default heuristics.');
        handleGeminiError(aiErr);
        // Basic heuristics if AI fails
        const descLower = description.toLowerCase();
        if (descLower.includes('pothole') || descLower.includes('road') || descLower.includes('pavement')) {
          finalCategory = 'Roads & Potholes';
          finalUrgency = 'High';
        } else if (descLower.includes('water') || descLower.includes('leak') || descLower.includes('flood') || descLower.includes('pipe')) {
          finalCategory = 'Water & Leakage';
          finalUrgency = descLower.includes('burst') || descLower.includes('gush') ? 'Critical' : 'Medium';
        } else if (descLower.includes('garbage') || descLower.includes('waste') || descLower.includes('dump') || descLower.includes('sanitation')) {
          finalCategory = 'Waste & Sanitation';
        } else if (descLower.includes('light') || descLower.includes('lamp') || descLower.includes('bulb') || descLower.includes('dark')) {
          finalCategory = 'Streetlights';
        } else if (descLower.includes('park') || descLower.includes('playground') || descLower.includes('bench') || descLower.includes('sidewalk')) {
          finalCategory = 'Public Facilities';
        }
      }
    } else {
      console.log('Gemini API not available. Utilizing standard rule heuristics.');
      // Rule based heuristics
      const descLower = description.toLowerCase();
      if (descLower.includes('pothole') || descLower.includes('road') || descLower.includes('street')) {
        finalCategory = 'Roads & Potholes';
        finalUrgency = 'High';
      } else if (descLower.includes('leak') || descLower.includes('pipe') || descLower.includes('water')) {
        finalCategory = 'Water & Leakage';
        finalUrgency = 'Critical';
      }
    }

    // Generate random lat/lng nearby the appropriate district center if coordinates are empty
    let defaultCenterLat = 37.7749;
    let defaultCenterLng = -122.4194;
    if (finalNeighborhood === 'Riverbend District') {
      defaultCenterLat = 37.7900;
      defaultCenterLng = -122.4010;
    } else if (finalNeighborhood === 'Pinecrest Hills') {
      defaultCenterLat = 37.7550;
      defaultCenterLng = -122.4400;
    } else if (finalNeighborhood === 'Metro Center') {
      defaultCenterLat = 37.7850;
      defaultCenterLng = -122.4100;
    }

    const lat = location.lat || (defaultCenterLat + (Math.random() - 0.5) * 0.012);
    const lng = location.lng || (defaultCenterLng + (Math.random() - 0.5) * 0.015);

    const newIssue: Issue = {
      id: String(issues.length + 1),
      title: finalTitle,
      description,
      category: finalCategory as any,
      urgency: finalUrgency as any,
      status: 'Reported',
      neighborhood: finalNeighborhood,
      location: {
        lat,
        lng,
        address: location.address
      },
      reportedBy: reportedBy || 'Anonymous Hero',
      reportedAt: new Date().toISOString(),
      verifiedByCount: 1,
      verifiedUsers: [reportedBy || 'Anonymous Hero'],
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1584467541268-b040f83be3fd?auto=format&fit=crop&q=80&w=800',
      estimatedDaysToResolve: finalEstimatedDays,
      aiAnalysis: finalAiAnalysis,
      timeline: [
        {
          status: 'Reported',
          description: `Issue reported by ${reportedBy || 'Anonymous Hero'}. Automated AI analysis and categorizing completed successfully.`,
          timestamp: new Date().toISOString()
        }
      ],
      comments: []
    };

    issues.unshift(newIssue); // Put it at the top of the list
    res.status(201).json(newIssue);
  } catch (err: any) {
    console.error('Error creating issue:', err);
    res.status(500).json({ error: 'Failed to report community issue.' });
  }
});

// 4. Verify/Upvote an issue
app.post('/api/issues/:id/verify', (req, res) => {
  const { id } = req.params;
  const { userName } = req.body;

  const issue = issues.find(i => i.id === id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found.' });
  }

  const name = userName || 'Anonymous Citizen';

  if (issue.verifiedUsers.includes(name)) {
    return res.status(400).json({ error: 'You have already verified this issue.' });
  }

  issue.verifiedByCount++;
  issue.verifiedUsers.push(name);

  // Gamification: If verifiedByCount reaches 5, auto verify/validate on city timeline
  if (issue.verifiedByCount === 5 && issue.status === 'Reported') {
    issue.status = 'Verified';
    issue.timeline.push({
      status: 'Verified',
      description: 'Community Verification Threshold Met! Handed over to local public works division.',
      timestamp: new Date().toISOString()
    });
  } else {
    // Add simple notification update
    issue.timeline.push({
      status: issue.status,
      description: `Community support registered. Verified by ${name}.`,
      timestamp: new Date().toISOString()
    });
  }

  res.json(issue);
});

// 5. Update issue status (Simulation)
app.post('/api/issues/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  const allowedStatuses = ['Reported', 'Verified', 'In Progress', 'Resolved'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const issue = issues.find(i => i.id === id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found.' });
  }

  issue.status = status;
  issue.timeline.push({
    status,
    description: remarks || `Status updated to ${status} by Municipal Operations Team.`,
    timestamp: new Date().toISOString()
  });

  res.json(issue);
});

// 6. Add comment
app.post('/api/issues/:id/comments', (req, res) => {
  const { id } = req.params;
  const { userName, text } = req.body;

  if (!userName || !text) {
    return res.status(400).json({ error: 'Name and comment text are required.' });
  }

  const issue = issues.find(i => i.id === id);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found.' });
  }

  const newComment: Comment = {
    id: 'c_' + Date.now(),
    userName,
    text,
    timestamp: new Date().toISOString()
  };

  issue.comments.push(newComment);
  res.status(201).json(newComment);
});

// 7. Get Predictive AI Insights and Neighborhood Health recommendations
app.get('/api/insights', async (req, res) => {
  const { neighborhood } = req.query;
  const targetNeighborhood = (neighborhood as string) || 'All';

  // Customized fallback insights depending on the neighborhood
  let defaultInsights = [
    {
      title: 'Water Mains Infrastructure Strain Detected',
      description: 'We have identified a clustering of water leakage issues near Kalyanpur Reserve Park within a 500m radius. This points to systematic water grid pressure spikes or aging pipes.',
      severity: 'Urgent',
      affectedArea: 'Kalyanpur, Kanpur / Ashiana Avenue',
      recommendingAction: 'City utility should initiate pipe thickness ultrasonic scans and pressure-release valve installations.',
      impactOfAction: 'Prevents structural road collapse (sinkholes) and saves over 100,000 gallons of treated potable water.'
    },
    {
      title: 'Pedestrian Blind Spot Warning',
      description: 'Multiple active streetlight failure reports at key crosswalks. Crash risks increase by 45% under current light levels during evening hours.',
      severity: 'Warning',
      affectedArea: 'G T Road & Sharda Nagar Transit Corridor',
      recommendingAction: 'Deploy mobile floodlight trailers and accelerate physical wiring repairs at the compromised junction box.',
      impactOfAction: 'Enhances safety for 500+ evening commuters and eliminates vehicle-pedestrian conflict risks.'
    },
    {
      title: 'Pre-emptive Pothole Clustering Forecast',
      description: 'With heavy monsoon rainfall predicted next week, hairline cracks currently logged in roads are highly likely to expand into vehicle-damaging potholes due to asphalt subbase water saturation.',
      severity: 'Info',
      affectedArea: 'Kalyanpur Road & Boulevard Area',
      recommendingAction: 'Initiate localized crack-seal repairs prior to precipitation onset.',
      impactOfAction: 'Reduces emergency hot-mix patching costs by 60% and avoids damage claims from local drivers.'
    }
  ];

  if (targetNeighborhood === 'Riverbend District') {
    defaultInsights = [
      {
        title: 'Maritime Drainage Siltation Vulnerability',
        description: 'Frequent high tides combined with seasonal river runoffs are depositing sediment, causing recurring drainage blocks at Riverbend Marina.',
        severity: 'Urgent',
        affectedArea: 'River Road & Marina pathways',
        recommendingAction: 'Install secondary sediment traps and schedule bi-weekly marine vacuuming during winter cycles.',
        impactOfAction: 'Eliminates path flooding hazards for cyclists and prevents local fish market basement inundation.'
      },
      {
        title: 'Commercial Waste Vector Accumulation',
        description: 'Trash build-up behind seafood facilities has caused a 30% increase in scavenger activity, threatening local hygiene.',
        severity: 'Warning',
        affectedArea: 'Dock Street alleyways',
        recommendingAction: 'Transition to secure heavy-duty metal containment lockers and introduce smart fill-level alert sensors.',
        impactOfAction: 'Protects neighborhood sanitation scores and deters public health issues.'
      }
    ];
  } else if (targetNeighborhood === 'Pinecrest Hills') {
    defaultInsights = [
      {
        title: 'Slope Erosion & Landslide Hazard Alert',
        description: 'Saturated hillside soil is triggering micro-slides of shale and wet clay onto high-speed blind curves along Ridge Road.',
        severity: 'Urgent',
        affectedArea: 'Ridge Road blind curves (1200 Block)',
        recommendingAction: 'Deploy high-tension slope stabilization wire mesh and configure solar-powered motion sensory beacons.',
        impactOfAction: 'Mitigates vehicle-impact risks on winding cliffs and prevents prolonged corridor closures.'
      },
      {
        title: 'Hilly Forest Pathway Blackouts',
        description: 'Tree branch canopy friction during high winds is causing repetitive substation breaker tripping on Summit Path.',
        severity: 'Warning',
        affectedArea: 'Summit Path transit corridor',
        recommendingAction: 'Coordinate localized canopy pruning around electrical lines and upgrade line insulators.',
        impactOfAction: 'Restores pedestrian path safety and safeguards high-elevation residential grid stability.'
      }
    ];
  } else if (targetNeighborhood === 'Metro Center') {
    defaultInsights = [
      {
        title: 'Transit Shelter Glazing Fragility',
        description: 'A study of high-traffic transit shelters shows glass elements are vulnerable to temperature shocks and physical vandalism.',
        severity: 'Warning',
        affectedArea: 'Broadway transit shelter grid',
        recommendingAction: 'Retrofit existing canopy shelters with impact-resistant, lightweight cellular polycarbonate panels.',
        impactOfAction: 'Prevents overhead glass shatter injuries and dramatically reduces recurring municipal repair costs.'
      },
      {
        title: 'Plaza Fountain Filtration Overload',
        description: 'Heavy micro-trash dumping is causing filtration pump seizing at central water water features.',
        severity: 'Info',
        affectedArea: 'Central Plaza public fountain',
        recommendingAction: 'Install fine-mesh pre-filtration cages and increase neighborhood litter bins.',
        impactOfAction: 'Saves pump motors from burnouts and preserves clean urban visual aesthetics.'
      }
    ];
  }

  // Handle Live GPS Location custom fallback entries
  if (targetNeighborhood === 'Live GPS Location') {
    defaultInsights = [
      {
        title: 'Localized GPS Proximity Incidents',
        description: 'Analysis of reported safety and infrastructure issues within 500 meters of your live coordinates.',
        severity: 'Info',
        affectedArea: 'Within 500m of your current position',
        recommendingAction: 'Monitor real-time status feed and maintain safety awareness when traversing active worksites.',
        impactOfAction: 'Ensures immediate localized situational awareness and speeds up citizen hazard feedback loops.'
      },
      ...defaultInsights
    ];
  }

  const now = Date.now();

  // 1. Check in-memory Cache first to prevent redundant API queries
  if (insightsCache[targetNeighborhood] && (now - insightsCache[targetNeighborhood].timestamp < INSIGHTS_CACHE_TTL_MS)) {
    console.log(`[Cache Hit] Returning cached insights for neighborhood: ${targetNeighborhood}`);
    return res.json(insightsCache[targetNeighborhood].data);
  }

  // 2. Check if the API is currently throttled due to rate limiting or quota exhaustion
  if (isQuotaExhausted && now < quotaResetTime) {
    console.log(`[AI Throttled] Gemini API is currently throttled to protect quota limits. Returning curated fallback insights.`);
    return res.json(defaultInsights);
  } else {
    isQuotaExhausted = false; // Reset throttle flag
  }

  if (ai) {
    try {
      console.log(`Generating customized predictive insights for neighborhood: ${targetNeighborhood} using Gemini AI...`);
      
      const filteredIssuesForInsights = (targetNeighborhood !== 'All' && targetNeighborhood !== 'Global')
        ? issues.filter(i => i.neighborhood === targetNeighborhood)
        : issues;

      const issueSummary = filteredIssuesForInsights.map(i => ({
        id: i.id,
        category: i.category,
        urgency: i.urgency,
        status: i.status,
        neighborhood: i.neighborhood,
        address: i.location.address,
        title: i.title,
        description: i.description
      }));

      const promptText = `As the Predictive Analytics Coordinator of Community Hero, review the following array of reported community issues in our database for neighborhood context "${targetNeighborhood}":
      ${JSON.stringify(issueSummary, null, 2)}
      
      Generate a customized, professional "Neighborhood Health & Predictive Insights" report consisting of 2-3 distinct insights tailored to this neighborhood or the city-wide patterns if "All/Global" is selected.
      Analyze clusters, categories, safety hazards, and infrastructure relationships.
      Return the results as a JSON array matching the specified schema. Keep text actionable and highly professional. No markdown decoration.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Short catchy name of the prediction/hazard' },
                description: { type: Type.STRING, description: 'Explanation of the trend or root cause hazard' },
                severity: { type: Type.STRING, description: 'Info, Warning, or Urgent' },
                affectedArea: { type: Type.STRING, description: 'Which street, park, or zone is affected' },
                recommendingAction: { type: Type.STRING, description: 'Actionable steps for city council, utilities, or citizens' },
                impactOfAction: { type: Type.STRING, description: 'Key positive benefit or hazard avoided' }
              },
              required: ['title', 'description', 'severity', 'affectedArea', 'recommendingAction', 'impactOfAction']
            }
          }
        }
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = cleanAndParseJson(rawText);
        // Save successfully parsed response to cache
        insightsCache[targetNeighborhood] = {
          data: parsed,
          timestamp: now
        };
        return res.json(parsed);
      }
    } catch (err) {
      console.warn('Gemini insights generation failed. Returning default curated predictions.');
      handleGeminiError(err);
      
      // Cache fallback results for 2 minutes to throttle API requests
      insightsCache[targetNeighborhood] = {
        data: defaultInsights,
        timestamp: now - INSIGHTS_CACHE_TTL_MS + (2 * 60 * 1000) // Resets in 2 minutes
      };
    }
  }

  // Fallback
  res.json(defaultInsights);
});


// Serve static frontend assets / mount Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware integrated.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production build assets from:', distPath);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express custom server successfully listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
