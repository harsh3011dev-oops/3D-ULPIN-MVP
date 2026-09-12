// ── Homepage 3D India Visual Landmark Locations ──
// NOTE: This data is strictly for homepage visual storytelling and is separate from production GIS pipelines.

export interface VisualLandmark {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string;
  modelPath?: string;
  visualScale: number;
  rotation?: [number, number, number];
  visualType: 
    | 'taj_mahal'
    | 'india_gate'
    | 'red_fort'
    | 'qutub_minar'
    | 'gateway_of_india'
    | 'golden_temple'
    | 'charminar'
    | 'konark_temple'
    | 'meenakshi_temple'
    | 'ram_mandir'
    | 'generic';
}

export const HOMEPAGE_LANDMARKS: VisualLandmark[] = [
  {
    id: 'ayodhya-ram-mandir',
    name: 'Ayodhya Ram Mandir',
    city: 'Ayodhya',
    state: 'Uttar Pradesh',
    latitude: 26.7956,
    longitude: 82.1944,
    category: 'Sacred Nagara Architecture',
    description: 'High-detail 3D Nagara-style temple architectural model with multi-tier Shikharas.',
    modelPath: '/models/ram-mandir.glb',
    visualScale: 0.08,
    visualType: 'ram_mandir',
  },
  {
    id: 'taj-mahal',
    name: 'Taj Mahal',
    city: 'Agra',
    state: 'Uttar Pradesh',
    latitude: 27.1751,
    longitude: 78.0421,
    category: 'UNESCO World Heritage',
    description: 'Mughal architectural landmark on the Yamuna riverbank.',
    modelPath: '/models/taj_mahal.glb',
    visualScale: 0.95,
    visualType: 'taj_mahal',
  },
  {
    id: 'india-gate',
    name: 'India Gate',
    city: 'New Delhi',
    state: 'Delhi',
    latitude: 28.6129,
    longitude: 77.2295,
    category: 'National Monument',
    description: '42-meter triumphal arch on the Rajpath ceremonial axis.',
    modelPath: '/models/india_gate.glb',
    visualScale: 0.95,
    visualType: 'india_gate',
  },
  {
    id: 'red-fort',
    name: 'Red Fort',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.6562,
    longitude: 77.2410,
    category: 'Historic Fortress',
    description: 'Octagonal red sandstone citadel of the Mughal Empire.',
    modelPath: '/models/red_fort.glb',
    visualScale: 0.90,
    visualType: 'red_fort',
  },
  {
    id: 'qutub-minar',
    name: 'Qutub Minar',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.5244,
    longitude: 77.1855,
    category: 'UNESCO World Heritage',
    description: '72.5-meter fluted red sandstone minaret built in 1192.',
    modelPath: '/models/qutub_minar.glb',
    visualScale: 1.15,
    visualType: 'qutub_minar',
  },
  {
    id: 'gateway-of-india',
    name: 'Gateway of India',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 18.9220,
    longitude: 72.8347,
    category: 'Maritime Monument',
    description: 'Indo-Saracenic basalt arch overlooking the Arabian Sea.',
    modelPath: '/models/gateway_of_india.glb',
    visualScale: 0.95,
    visualType: 'gateway_of_india',
  },
  {
    id: 'golden-temple',
    name: 'Golden Temple (Harmandir Sahib)',
    city: 'Amritsar',
    state: 'Punjab',
    latitude: 31.6200,
    longitude: 74.8765,
    category: 'Spiritual Sanctum',
    description: 'Gilded central sanctum surrounded by the sacred Amrit Sarovar.',
    modelPath: '/models/golden_temple.glb',
    visualScale: 0.90,
    visualType: 'golden_temple',
  },
  {
    id: 'charminar',
    name: 'Charminar',
    city: 'Hyderabad',
    state: 'Telangana',
    latitude: 17.3616,
    longitude: 78.4747,
    category: 'Historic Monument',
    description: 'Four-minaret monument and mosque commissioned in 1591.',
    modelPath: '/models/charminar.glb',
    visualScale: 0.95,
    visualType: 'charminar',
  },
  {
    id: 'konark-temple',
    name: 'Konark Sun Temple',
    city: 'Konark',
    state: 'Odisha',
    latitude: 19.8876,
    longitude: 86.0945,
    category: 'UNESCO World Heritage',
    description: '13th-century Sun Temple shaped as a colossal chariot.',
    modelPath: '/models/konark_temple.glb',
    visualScale: 0.90,
    visualType: 'konark_temple',
  },
  {
    id: 'meenakshi-temple',
    name: 'Meenakshi Temple',
    city: 'Madurai',
    state: 'Tamil Nadu',
    latitude: 9.9195,
    longitude: 78.1193,
    category: 'Dravidian Architecture',
    description: 'Historic Hindu temple with 14 towering multi-tiered gopurams.',
    modelPath: '/models/meenakshi_temple.glb',
    visualScale: 0.95,
    visualType: 'meenakshi_temple',
  },
];

// Major Indian metropolitan and cadastral hub nodes
export const INDIA_MAJOR_HUBS = [
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090, state: 'DL', type: 'national' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, state: 'MH', type: 'financial' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, state: 'KA', type: 'tech' },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, state: 'TG', type: 'tech' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, state: 'TN', type: 'port' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, state: 'WB', type: 'cultural' },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, state: 'GJ', type: 'commercial' },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873, state: 'RJ', type: 'heritage' },
  { name: 'Varanasi', lat: 25.3176, lon: 82.9739, state: 'UP', type: 'spiritual' },
  { name: 'Bhubaneswar', lat: 20.2961, lon: 85.8245, state: 'OD', type: 'smartcity' },
];

/**
 * Converts latitude and longitude to 3D Cartesian coordinates on a globe
 * centered visually on India (approx 22° N, 79° E).
 */
export function geoToGlobePosition(
  lat: number,
  lon: number,
  radius = 6.8,
  centerLat = 22.5,
  centerLon = 79.0
): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon - centerLon) * Math.PI) / 180;

  const x = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi) - radius * Math.cos(((90 - centerLat) * Math.PI) / 180);
  const z = radius * Math.sin(phi) * Math.cos(theta) - radius * 0.72;

  return [x, y, z];
}
