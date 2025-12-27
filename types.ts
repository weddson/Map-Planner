
export interface Point {
  x: number;
  y: number;
}

export type MarkerStatus = 'pending' | 'completed' | 'active';

export interface Marker {
  id: string;
  name: string;
  number?: string;
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

export type Tool = 'select' | 'marker' | 'path';