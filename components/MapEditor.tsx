
import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { Marker, Path, Point, Tool } from '../types.ts';

interface MapEditorProps {
  imageSrc: string;
  markers: Marker[];
  paths: Path[];
  activeTool: Tool;
  selectedElement: { type: 'marker' | 'path'; id: string } | null;
  onAddMarker: (position: Point) => void;
  onAddPathPoint: (point: Point) => void;
  onUpdateMarker: (id: string, data: Partial<Marker>) => void;
  onUpdatePath: (id: string, data: Partial<Path>) => void;
  onSelectElement: (selection: { type: 'marker' | 'path'; id: string } | null) => void;
  linkingState: { fromMarkerId: string } | null;
  onLinkMarkers: (toMarkerId: string) => void;
  onInsertPathPoint: (pathId: string, point: Point, index: number) => void;
  zoom: number;
  showMarkerLabels: boolean;
}

const pointsToPathD = (points: Point[]): string => {
  if (points.length < 2) return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    d += ` Q ${p1.x} ${p1.y}, ${midPoint.x} ${midPoint.y}`;
  }
  d += ` L ${points[points.length-1].x} ${points[points.length-1].y}`;
  return d;
};

export const MapEditor: React.FC<MapEditorProps> = ({
  imageSrc,
  markers,
  paths,
  activeTool,
  selectedElement,
  onAddMarker,
  onAddPathPoint,
  onUpdateMarker,
  onUpdatePath,
  onSelectElement,
  linkingState,
  onLinkMarkers,
  onInsertPathPoint,
  zoom,
  showMarkerLabels,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ type: 'marker' | 'pathPoint'; id: string; pointIndex?: number } | null>(null);

  const getMousePos = (e: MouseEvent<SVGElement>): Point => {
    const svg = e.currentTarget;
    const CTM = svg.getScreenCTM();
    if (CTM) {
      return {
        x: (e.clientX - CTM.e) / CTM.a,
        y: (e.clientY - CTM.f) / CTM.d,
      };
    }
    return { x: 0, y: 0 };
  };

  const handleMouseDown = (e: MouseEvent<SVGElement>) => {
    if (linkingState) return;
    const pos = getMousePos(e);

    // Deselect when clicking on empty space with the select tool
    if (activeTool === 'select') {
      // Draggable elements stop propagation, so this only fires on the background
      onSelectElement(null);
    }

    if (activeTool === 'marker') {
      onAddMarker(pos);
    } else if (activeTool === 'path') {
      onAddPathPoint(pos);
    }
  };

  const handleMouseMove = (e: MouseEvent<SVGElement>) => {
    if (!dragging) return;
    const pos = getMousePos(e);

    if (dragging.type === 'marker') {
      onUpdateMarker(dragging.id, { position: pos });
    } else if (dragging.type === 'pathPoint') {
      const path = paths.find(p => p.id === dragging.id);
      if (path && dragging.pointIndex !== undefined) {
        const newPoints = [...path.points];
        newPoints[dragging.pointIndex] = pos;
        onUpdatePath(path.id, { points: newPoints });
      }
    }
  };

  const handleMouseUp = () => setDragging(null);

  const getCursor = () => {
    if (linkingState) return 'crosshair';
    return { select: 'default', marker: 'crosshair', path: 'crosshair' }[activeTool];
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-auto">
      <div 
        className="relative shadow-2xl"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <img src={imageSrc} alt="Dungeon Map" className="block" />
        <svg
          className="absolute top-0 left-0 w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: getCursor() }}
        >
          {paths.map(path => {
            const isSelected = selectedElement?.id === path.id;
            const strokeColor = isSelected ? '#0ea5e9' : (path.color || '#f59e0b');
            const strokeWidth = isSelected ? 5 : 3;

            return (
              <g key={path.id}>
                <path
                    d={pointsToPathD(path.points)}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                    className="pointer-events-auto"
                    onClick={(e) => { e.stopPropagation(); if(activeTool === 'select' && !linkingState) onSelectElement({ type: 'path', id: path.id }); }}
                 />
                <path
                    d={pointsToPathD(path.points)}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}

          {markers.map(marker => {
            const markerColor = marker.color || '#10b981';
            return (
              <g key={marker.id} transform={`translate(${marker.position.x}, ${marker.position.y})`}>
                <circle r="12" fill={`${markerColor}66`} stroke={markerColor} strokeWidth="2" />
                <circle
                  r="6"
                  fill={selectedElement?.id === marker.id ? '#0ea5e9' : markerColor}
                  stroke="#fff" strokeWidth="2"
                  className="pointer-events-auto"
                  onClick={(e) => {
                      e.stopPropagation();
                      if (linkingState && linkingState.fromMarkerId !== marker.id) {
                          onLinkMarkers(marker.id);
                      } else if (activeTool === 'select') {
                          onSelectElement({ type: 'marker', id: marker.id });
                      }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'select' && !linkingState) {
                      setDragging({ type: 'marker', id: marker.id });
                    }
                  }}
                  style={{ cursor: linkingState ? 'pointer' : activeTool === 'select' ? 'grab' : undefined }}
                />
                {showMarkerLabels && (
                  <text
                    x="15"
                    y="5"
                    fill="white"
                    fontSize="12"
                    fontFamily="sans-serif"
                    paintOrder="stroke"
                    stroke="black"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                  >
                    {marker.number ? `${marker.number} - ${marker.name}` : marker.name}
                  </text>
                )}
              </g>
            )
          })}
          
          {selectedElement?.type === 'path' && paths.find(p => p.id === selectedElement.id)?.points.map((point, index, points) => {
            const path = paths.find(p => p.id === selectedElement.id);
            if (!path) return null;
            
            const isLinked = !!path.linkedMarkers;
            const isEndpoint = index === 0 || index === points.length - 1;
            const canDrag = !isLinked || !isEndpoint;

            return (
              <circle
                key={`${selectedElement.id}-point-${index}`}
                cx={point.x} cy={point.y} r="6"
                fill={canDrag ? "#fff" : "#f87171"}
                stroke="#0ea5e9" strokeWidth="2"
                className="pointer-events-auto"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'select' && canDrag) {
                    setDragging({ type: 'pathPoint', id: selectedElement.id, pointIndex: index });
                  }
                }}
                style={{ cursor: canDrag ? 'grab' : 'not-allowed' }}
              />
            );
          })}

          {activeTool === 'select' && selectedElement?.type === 'path' && paths.find(p => p.id === selectedElement.id)?.points.map((point, index, points) => {
             if (index === points.length - 1) return null;
             const path = paths.find(p => p.id === selectedElement.id);
             if (!path) return null;

             const p1 = points[index];
             const p2 = points[index+1];
             const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
             
             return (
                <circle
                    key={`${selectedElement.id}-midpoint-${index}`}
                    cx={midPoint.x} cy={midPoint.y} r={5}
                    fill="rgba(255, 255, 255, 0.5)"
                    stroke="#0ea5e9" strokeWidth="2"
                    className="pointer-events-auto"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        const currentMousePos = getMousePos(e);
                        onInsertPathPoint(path.id, currentMousePos, index + 1);
                        setDragging({ type: 'pathPoint', id: path.id, pointIndex: index + 1 });
                    }}
                    style={{ cursor: 'grab' }}
                />
             )
          })}
        </svg>
      </div>
    </div>
  );
};