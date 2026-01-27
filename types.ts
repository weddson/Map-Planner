
export interface Point {
  x: number;
  y: number;
}

export type MarkerStatus = 'pending' | 'completed' | 'active';

export interface Marker {
  id: string;
  name: string;
  number?: string;
  area?: string;
  position: Point;
  status: MarkerStatus;
  linkedMarkerIds?: string[];
  color?: string;
}

export interface Path {
  id: string;
  points: Point[];
  linkedMarkers?: {
    startId: string;
    endId: string;
  }
  color?: string;
}

export interface Area {
  id: string;
  name: string;
  number?: string;
  center: Point;
  radius: number; // pixels
  topLeft: Point;
  bottomRight: Point;
}

export interface PolygonArea {
  id: string;
  name: string;
  number?: string;
  points: Point[];
}

export type Tool = 'select' | 'marker' | 'path' | 'area' | 'polygon-area';
