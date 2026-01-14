
import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { Area, Marker, Path, Point, Tool } from '../types.ts';

interface MapEditorProps {
  imageSrc: string;
  imageSize: { width: number; height: number } | null;
  markers: Marker[];
  paths: Path[];
  areas: Area[];
  activeTool: Tool;
  selectedElement: { type: 'marker' | 'path' | 'area'; id: string } | null;
  onAddMarker: (position: Point) => void;
  onAddPathPoint: (point: Point) => void;
  onAddAreaPoint: (point: Point) => void;
  onUpdateMarker: (id: string, data: Partial<Marker>) => void;
  onUpdatePath: (id: string, data: Partial<Path>) => void;
  onUpdateArea: (id: string, data: Partial<Area>) => void;
  onSelectElement: (selection: { type: 'marker' | 'path' | 'area'; id: string } | null) => void;
  linkingState: { fromMarkerId: string } | null;
  onLinkMarkers: (toMarkerId: string) => void;
  onInsertPathPoint: (pathId: string, point: Point, index: number) => void;
  drawingArea: { id: string; center: Point } | null;
  zoom: number;
  markerSize: number;
  labelSize: number;
  showMarkerLabels: boolean;
  showAreaLabels: boolean;
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
  imageSize,
  markers,
  paths,
  areas,
  activeTool,
  selectedElement,
  onAddMarker,
  onAddPathPoint,
  onAddAreaPoint,
  onUpdateMarker,
  onUpdatePath,
  onUpdateArea,
  onSelectElement,
  linkingState,
  onLinkMarkers,
  onInsertPathPoint,
  drawingArea,
  zoom,
  markerSize,
  labelSize,
  showMarkerLabels,
  showAreaLabels,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ type: 'marker' | 'pathPoint' | 'areaCenter' | 'areaRadius'; id: string; pointIndex?: number } | null>(null);

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
    } else if (activeTool === 'area') {
      onAddAreaPoint(pos);
    }
  };

  const handleMouseMove = (e: MouseEvent<SVGElement>) => {
    const pos = getMousePos(e);

    // While drawing a new area: preview radius by mouse move
    if (!dragging && activeTool === 'area' && drawingArea && !linkingState) {
      const dx = pos.x - drawingArea.center.x;
      const dy = pos.y - drawingArea.center.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      onUpdateArea(drawingArea.id, { radius: Math.max(1, r) });
      return;
    }

    if (!dragging) return;

    if (dragging.type === 'marker') {
      onUpdateMarker(dragging.id, { position: pos });
    } else if (dragging.type === 'pathPoint') {
      const path = paths.find(p => p.id === dragging.id);
      if (path && dragging.pointIndex !== undefined) {
        const newPoints = [...path.points];
        newPoints[dragging.pointIndex] = pos;
        onUpdatePath(path.id, { points: newPoints });
      }
    } else if (dragging.type === 'areaCenter') {
      onUpdateArea(dragging.id, { center: pos });
    } else if (dragging.type === 'areaRadius') {
      const area = areas.find(a => a.id === dragging.id);
      if (!area) return;
      const dx = pos.x - area.center.x;
      const dy = pos.y - area.center.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      onUpdateArea(area.id, { radius: Math.max(1, r) });
    }
  };

  const handleMouseUp = () => setDragging(null);

  const getCursor = () => {
    if (linkingState) return 'crosshair';
    return { select: 'default', marker: 'crosshair', path: 'crosshair', area: 'crosshair' }[activeTool];
  };

  const getRadiusHandlePos = (area: Area): Point => ({ x: area.center.x + Math.max(1, area.radius), y: area.center.y });

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-auto"
    >
      <div 
        className="relative shadow-2xl"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <img src={imageSrc} alt="Map" className="block" />
        <svg
          className="absolute top-0 left-0 w-full h-full"
          viewBox={imageSize ? `0 0 ${imageSize.width} ${imageSize.height}` : undefined}
          preserveAspectRatio="none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: getCursor() }}
        >
          {areas.map(area => {
            const isSelected = selectedElement?.type === 'area' && selectedElement.id === area.id;
            const fillColor = '#facc15';
            const strokeColor = isSelected ? '#0ea5e9' : '#facc15';
            const strokeWidth = isSelected ? 4 : 2;
            const label = area.number ? `${area.number} - ${area.name}` : area.name;

            return (
              <g key={area.id}>
                {/* Click target */}
                <circle
                  cx={area.center.x}
                  cy={area.center.y}
                  r={Math.max(1, area.radius) + 8}
                  fill="transparent"
                  fillOpacity={0}
                  stroke="transparent"
                  strokeWidth={1}
                  className="pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'select' && !linkingState) {
                      onSelectElement({ type: 'area', id: area.id });
                    }
                  }}
                />

                <circle
                  cx={area.center.x}
                  cy={area.center.y}
                  r={Math.max(1, area.radius)}
                  fill={fillColor}
                  fillOpacity={0.25}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  style={{ pointerEvents: 'none' }}
                />
                {showMarkerLabels && (
                  <text
                    x={area.center.x}
                    y={area.center.y}
                    fill="black"
                    fontSize={14 * labelSize}
                    fontFamily="sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    paintOrder="stroke"
                    stroke="white"
                    strokeWidth={3 * labelSize}
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}

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
            const outerR = 12 * markerSize;
            const innerR = 6 * markerSize;
            return (
              <g key={marker.id} transform={`translate(${marker.position.x}, ${marker.position.y})`}>
                <circle r={outerR} fill={`${markerColor}66`} stroke={markerColor} strokeWidth={2 * markerSize} />
                <circle
                  r={innerR}
                  fill={selectedElement?.id === marker.id ? '#0ea5e9' : markerColor}
                  stroke="#fff" strokeWidth={2 * markerSize}
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
                    x={15 * markerSize}
                    y={5 * labelSize}
                    fill="white"
                    fontSize={12 * labelSize}
                    fontFamily="sans-serif"
                    paintOrder="stroke"
                    stroke="black"
                    strokeWidth={3 * labelSize}
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                  >
                    {marker.number ? `${marker.number} - ${marker.name}` : marker.name}
                  </text>
                )}
                {showAreaLabels && marker.area && (
                  <text
                    x={15 * markerSize}
                    y={showMarkerLabels ? (5 * labelSize + 14 * labelSize) : 5 * labelSize}
                    fill="#facc15"
                    fontSize={10 * labelSize}
                    fontFamily="sans-serif"
                    paintOrder="stroke"
                    stroke="black"
                    strokeWidth={2 * labelSize}
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                  >
                    [{marker.area}]
                  </text>
                )}
              </g>
            )
          })}

          {activeTool === 'select' && selectedElement?.type === 'area' && (() => {
            const area = areas.find(a => a.id === selectedElement.id);
            if (!area) return null;
            const handle = getRadiusHandlePos(area);

            return (
              <g>
                <circle
                  cx={area.center.x}
                  cy={area.center.y}
                  r={6}
                  fill="#fff"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  className="pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragging({ type: 'areaCenter', id: area.id });
                  }}
                  style={{ cursor: 'grab' }}
                />
                <circle
                  cx={handle.x}
                  cy={handle.y}
                  r={6}
                  fill="#fff"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  className="pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragging({ type: 'areaRadius', id: area.id });
                  }}
                  style={{ cursor: 'grab' }}
                />
              </g>
            );
          })()}
          
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