
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { MapEditor } from './components/MapEditor.tsx';
import { Area, Marker, Path, Point, Tool } from './types.ts';

const pointsToPathD = (points: Point[]): string => {
  if (points.length < 2) return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    d += ` Q ${p1.x} ${p1.y}, ${midPoint.x} ${midPoint.y}`;
  }
  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
};

const escapeXml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
);

const loadImage = (src: string): Promise<HTMLImageElement> => (
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  })
);

const distance = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

type ImageSize = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const areaBoundsFromCircle = (center: Point, radius: number, imageSize?: ImageSize): { topLeft: Point; bottomRight: Point } => {
  const r = Math.max(1, radius);
  let topLeft: Point = { x: center.x - r, y: center.y - r };
  let bottomRight: Point = { x: center.x + r, y: center.y + r };

  if (imageSize) {
    topLeft = {
      x: clamp(topLeft.x, 0, imageSize.width),
      y: clamp(topLeft.y, 0, imageSize.height),
    };
    bottomRight = {
      x: clamp(bottomRight.x, 0, imageSize.width),
      y: clamp(bottomRight.y, 0, imageSize.height),
    };
  }

  return { topLeft, bottomRight };
};

const circleFromBounds = (topLeft: Point, bottomRight: Point) => {
  const left = Math.min(topLeft.x, bottomRight.x);
  const right = Math.max(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const bottom = Math.max(topLeft.y, bottomRight.y);

  const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
  const halfW = (right - left) / 2;
  const halfH = (bottom - top) / 2;
  const radius = Math.max(1, Math.max(halfW, halfH));
  return { center, radius };
};

const normalizeAreas = (raw: unknown): Area[] => {
  if (!Array.isArray(raw)) return [];
  const areas: Area[] = [];

  for (const item of raw) {
    const anyItem = item as any;
    const id = typeof anyItem?.id === 'string' ? anyItem.id : `area-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const name = typeof anyItem?.name === 'string' ? anyItem.name : 'Area';
    const number = typeof anyItem?.number === 'string' ? anyItem.number : undefined;

    // New format (circle)
    if (
      anyItem?.center &&
      typeof anyItem.center.x === 'number' &&
      typeof anyItem.center.y === 'number' &&
      typeof anyItem.radius === 'number'
    ) {
      const r = Number.isFinite(anyItem.radius) ? Math.max(1, anyItem.radius) : 1;
      const center = { x: anyItem.center.x, y: anyItem.center.y };
      const { topLeft, bottomRight } = areaBoundsFromCircle(center, r);
      areas.push({ id, name, number, center, radius: r, topLeft, bottomRight });
      continue;
    }

    // Bounds format
    if (
      anyItem?.topLeft &&
      typeof anyItem.topLeft.x === 'number' &&
      typeof anyItem.topLeft.y === 'number' &&
      anyItem?.bottomRight &&
      typeof anyItem.bottomRight.x === 'number' &&
      typeof anyItem.bottomRight.y === 'number'
    ) {
      const topLeft: Point = { x: anyItem.topLeft.x, y: anyItem.topLeft.y };
      const bottomRight: Point = { x: anyItem.bottomRight.x, y: anyItem.bottomRight.y };
      const { center, radius } = circleFromBounds(topLeft, bottomRight);
      const bounds = areaBoundsFromCircle(center, radius);
      areas.push({ id, name, number, center, radius, topLeft: bounds.topLeft, bottomRight: bounds.bottomRight });
      continue;
    }

    // Legacy format (polygon points) -> convert to circle (centroid + max distance)
    if (Array.isArray(anyItem?.points) && anyItem.points.length) {
      const points: Point[] = anyItem.points
        .filter((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number')
        .map((p: any) => ({ x: p.x, y: p.y }));

      if (!points.length) continue;

      const center = {
        x: points.reduce((acc, p) => acc + p.x, 0) / points.length,
        y: points.reduce((acc, p) => acc + p.y, 0) / points.length,
      };
      const radius = Math.max(1, Math.max(...points.map(p => distance(center, p))));
      const bounds = areaBoundsFromCircle(center, radius);
      areas.push({ id, name, number, center, radius, topLeft: bounds.topLeft, bottomRight: bounds.bottomRight });
      continue;
    }
  }

  return areas;
};

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedElement, setSelectedElement] = useState<{ type: 'marker' | 'path' | 'area'; id: string } | null>(null);
  const [linkingState, setLinkingState] = useState<{ fromMarkerId: string } | null>(null);
  const [drawingPathId, setDrawingPathId] = useState<string | null>(null);
  const [drawingArea, setDrawingArea] = useState<{ id: string; center: Point } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [markerSize, setMarkerSize] = useState(1);
  const [labelSize, setLabelSize] = useState(1);
  const [showMarkerLabels, setShowMarkerLabels] = useState(true);
  const [showAreaLabels, setShowAreaLabels] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [colorFilters, setColorFilters] = useState<Record<string, boolean>>({});
  const [areaFilters, setAreaFilters] = useState<Record<string, boolean>>({});
  const [numberFilters, setNumberFilters] = useState<Record<string, boolean>>({});
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);

  // Load state from localStorage on initial render
  useEffect(() => {
    const savedState = localStorage.getItem('mapPlannerState');
    if (savedState) {
      try {
        const { image, markers, paths, areas } = JSON.parse(savedState);
        setImage(image);
        setMarkers(markers || []);
        setPaths(paths || []);
        setAreas(normalizeAreas(areas));
      } catch (error) {
        console.error("Failed to parse saved state:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!image) {
      setImageSize(null);
      return;
    }

    let cancelled = false;
    loadImage(image)
      .then(img => {
        if (cancelled) return;
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width && height) {
          setImageSize({ width, height });
        }
      })
      .catch(() => {
        if (!cancelled) setImageSize(null);
      });

    return () => {
      cancelled = true;
    };
  }, [image]);

  useEffect(() => {
    if (!imageSize) return;
    setAreas(prev => prev.map(a => {
      const bounds = areaBoundsFromCircle(a.center, a.radius, imageSize);
      return { ...a, topLeft: bounds.topLeft, bottomRight: bounds.bottomRight };
    }));
  }, [imageSize]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (image) {
      try {
        const stateToSave = { image, markers, paths, areas };
        localStorage.setItem('mapPlannerState', JSON.stringify(stateToSave));
      } catch (error) {
        console.error("Failed to save state:", error);
      }
    }
  }, [image, markers, paths, areas]);
  
  // Sync color filters with available marker colors
  useEffect(() => {
    const uniqueColors = new Set(markers.map(m => m.color || '#10b981'));
    setColorFilters(prevFilters => {
        const newFilters = { ...prevFilters };
        let updated = false;
        // Add new colors, default to true
        // FIX: Explicitly type 'color' as string to resolve issue with using it as an index.
        uniqueColors.forEach((color: string) => {
            if (newFilters[color] === undefined) {
                newFilters[color] = true;
                updated = true;
            }
        });
        // Remove colors that no longer exist
        Object.keys(newFilters).forEach(color => {
            if (!uniqueColors.has(color)) {
                delete newFilters[color];
                updated = true;
            }
        });
        return updated ? newFilters : prevFilters;
    });
  }, [markers]);

  // Deselect element if it gets filtered out
  useEffect(() => {
      if (selectedElement?.type === 'marker') {
          const marker = markers.find(m => m.id === selectedElement.id);
          if (marker) {
              const color = marker.color || '#10b981';
              if (colorFilters[color] === false) {
                  setSelectedElement(null);
              }
          }
      }
  }, [colorFilters, selectedElement, markers]);


  const handleFileUpload = (file: File) => {
    const reader = new FileReader();

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const { image, markers, paths, areas } = JSON.parse(text);
          const parsedAreas = normalizeAreas(areas);
          if (image && Array.isArray(markers) && Array.isArray(paths)) {
            setImage(image);
            setMarkers(markers);
            setPaths(paths);
            setAreas(parsedAreas);
            setSelectedElement(null);
            setLinkingState(null);
            setDrawingPathId(null);
            setDrawingArea(null);
          } else {
            alert("Invalid plan file format.");
          }
        } catch (error) {
          console.error("Failed to parse plan file:", error);
          alert("Could not read the plan file. It may be corrupted.");
        }
      };
      reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setMarkers([]);
        setPaths([]);
        setAreas([]);
        setSelectedElement(null);
        setLinkingState(null);
        setDrawingPathId(null);
        setDrawingArea(null);
        setImageSize(null);
      };
      reader.readAsDataURL(file);
    } else {
      alert("Unsupported file type. Please upload an image or a .json plan file.");
    }
  };
  
  const handleExportPlan = () => {
    if (!image) {
      alert("Please load a map before exporting.");
      return;
    }
    const stateToSave = { image, markers, paths, areas };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map-plan.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportLua = () => {
    if (!image && markers.length === 0 && areas.length === 0) {
      alert("No markers or areas to export.");
      return;
    }

    let lua = "-- Map Planner - Lua Export\n";
    lua += "-- Generated: " + new Date().toISOString() + "\n\n";

    // Exportar marcadores
    lua += "local markers = {\n";
    markers.forEach((marker, index) => {
      const x = Math.round(marker.position.x);
      const y = Math.round(marker.position.y);
      const name = marker.name.replace(/"/g, '\\"');
      const number = marker.number || '';
      const area = (marker.area || '').replace(/"/g, '\\"');
      lua += `    [${index + 1}] = { name = "${name}", number = "${number}", area = "${area}", x = ${x}, y = ${y} }`;
      lua += index < markers.length - 1 ? ",\n" : "\n";
    });
    lua += "}\n\n";

    // Exportar áreas (círculos)
    lua += "local areas = {\n";
    areas.forEach((area, index) => {
      const centerX = Math.round(area.center.x);
      const centerY = Math.round(area.center.y);
      const radius = Math.round(area.radius);
      const topLeftX = Math.round(area.topLeft.x);
      const topLeftY = Math.round(area.topLeft.y);
      const bottomRightX = Math.round(area.bottomRight.x);
      const bottomRightY = Math.round(area.bottomRight.y);
      const name = area.name.replace(/"/g, '\\"');
      const number = area.number || '';
      lua += `    [${index + 1}] = { name = "${name}", number = "${number}", centerX = ${centerX}, centerY = ${centerY}, radius = ${radius}, topLeftX = ${topLeftX}, topLeftY = ${topLeftY}, bottomRightX = ${bottomRightX}, bottomRightY = ${bottomRightY} }`;
      lua += index < areas.length - 1 ? ",\n" : "\n";
    });
    lua += "}\n\n";

    lua += "return { markers = markers, areas = areas }\n";

    const blob = new Blob([lua], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map-positions.lua';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPng = async () => {
    if (!image) {
      alert("Please load a map before exporting.");
      return;
    }

    try {
      const baseImage = await loadImage(image);
      const width = baseImage.naturalWidth || baseImage.width;
      const height = baseImage.naturalHeight || baseImage.height;

      const pathsMarkup = paths.map(path => {
        const strokeColor = path.color || '#f59e0b';
        return `
          <path
            d="${pointsToPathD(path.points)}"
            stroke="${strokeColor}"
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        `;
      }).join('');

      const areasMarkup = areas.map(area => {
        const fillColor = '#facc15';
        const strokeColor = '#facc15';
        const label = area.number ? `${area.number} - ${area.name}` : area.name;

        const textMarkup = showMarkerLabels ? `
          <text
            x="${area.center.x}"
            y="${area.center.y}"
            fill="black"
            font-size="14"
            font-family="sans-serif"
            text-anchor="middle"
            dominant-baseline="middle"
            paint-order="stroke"
            stroke="white"
            stroke-width="3"
            stroke-linejoin="round"
          >${escapeXml(label)}</text>
        ` : '';

        return `
          <g>
            <circle
              cx="${area.center.x}"
              cy="${area.center.y}"
              r="${Math.max(1, area.radius)}"
              fill="${fillColor}"
              fill-opacity="0.25"
              stroke="${strokeColor}"
              stroke-width="2"
            />
            ${textMarkup}
          </g>
        `;
      }).join('');

      const markersMarkup = markers.map(marker => {
        const markerColor = marker.color || '#10b981';
        const label = marker.number ? `${marker.number} - ${marker.name}` : marker.name;
        const textMarkup = showMarkerLabels ? `
          <text
            x="15"
            y="5"
            fill="white"
            font-size="12"
            font-family="sans-serif"
            paint-order="stroke"
            stroke="black"
            stroke-width="3"
            stroke-linejoin="round"
          >${escapeXml(label)}</text>
        ` : '';

        return `
          <g transform="translate(${marker.position.x}, ${marker.position.y})">
            <circle r="12" fill="${markerColor}66" stroke="${markerColor}" stroke-width="2" />
            <circle r="6" fill="${markerColor}" stroke="#fff" stroke-width="2" />
            ${textMarkup}
          </g>
        `;
      }).join('');

      const svgString = `<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <image href="${image}" x="0" y="0" width="${width}" height="${height}" />
          ${areasMarkup}
          ${pathsMarkup}
          ${markersMarkup}
        </svg>
      `;

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const svgImage = new Image();
      svgImage.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          alert("Failed to prepare export canvas.");
          return;
        }
        ctx.drawImage(svgImage, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(svgUrl);
          if (!blob) {
            alert("Failed to export PNG.");
            return;
          }
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = 'map-plan.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
        }, 'image/png');
      };
      svgImage.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        alert("Failed to generate PNG.");
      };
      svgImage.src = svgUrl;
    } catch (error) {
      console.error("PNG export failed:", error);
      alert("Could not export PNG. Please try again.");
    }
  };

  const handleResetWorkspace = () => {
    localStorage.removeItem('mapPlannerState');
    setImage(null);
    setMarkers([]);
    setPaths([]);
    setAreas([]);
    setSelectedElement(null);
    setLinkingState(null);
    setDrawingPathId(null);
    setDrawingArea(null);
    setZoom(1);
    setImageSize(null);
  };

  const addMarker = (position: Point) => {
    const newMarker: Marker = {
      id: `marker-${Date.now()}`,
      number: `${markers.length + 1}`,
      name: `New Marker`,
      position,
      status: 'pending',
      linkedMarkerIds: [],
      color: '#10b981', // Default color
    };
    setMarkers([...markers, newMarker]);
  };

  const addPathPoint = (point: Point) => {
    if (drawingPathId) {
      const path = paths.find(p => p.id === drawingPathId);
      if (path) {
        updatePath(drawingPathId, { points: [...path.points, point] });
      }
    } else {
      const newPath: Path = { id: `path-${Date.now()}`, points: [point], color: '#f59e0b' };
      setPaths(prevPaths => [...prevPaths, newPath]);
      setDrawingPathId(newPath.id);
      setSelectedElement(null);
    }
  };

  const addAreaPoint = (point: Point) => {
    // 1st click: set center
    if (!drawingArea) {
      const id = `area-${Date.now()}`;
      const initialRadius = 1;
      const bounds = areaBoundsFromCircle(point, initialRadius, imageSize || undefined);
      const newArea: Area = {
        id,
        number: `${areas.length + 1}`,
        name: 'New Area',
        center: point,
        radius: initialRadius,
        topLeft: bounds.topLeft,
        bottomRight: bounds.bottomRight,
      };
      setAreas(prev => [...prev, newArea]);
      setDrawingArea({ id, center: point });
      setSelectedElement({ type: 'area', id });
      return;
    }

    // 2nd click: set radius and finish
    const r = distance(drawingArea.center, point);
    updateArea(drawingArea.id, { radius: Math.max(1, r) });
    setDrawingArea(null);
  };

  const insertPathPoint = (pathId: string, point: Point, index: number) => {
    setPaths(currentPaths => currentPaths.map(p => {
        if (p.id === pathId) {
            const newPoints = [...p.points];
            newPoints.splice(index, 0, point);
            return { ...p, points: newPoints };
        }
        return p;
    }));
  };

  useEffect(() => {
    if (activeTool !== 'path') {
      setDrawingPathId(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'area') {
      setDrawingArea(null);
    }
  }, [activeTool]);

  const updateMarker = (id: string, newMarkerData: Partial<Marker>) => {
    setMarkers(markers.map(m => m.id === id ? { ...m, ...newMarkerData} : m));

    if (newMarkerData.position) {
        const newPos = newMarkerData.position;
        setPaths(currentPaths => currentPaths.map(p => {
            if (p.linkedMarkers?.startId === id) {
                const newPoints = [...p.points];
                newPoints[0] = newPos;
                return { ...p, points: newPoints };
            }
            if (p.linkedMarkers?.endId === id) {
                const newPoints = [...p.points];
                newPoints[newPoints.length - 1] = newPos;
                return { ...p, points: newPoints };
            }
            return p;
        }));
    }
  };
  
  const updatePath = (id: string, newPathData: Partial<Path>) => {
    setPaths(paths.map(p => p.id === id ? { ...p, ...newPathData } : p));
  };

  const updateArea = (id: string, newAreaData: Partial<Area>) => {
    setAreas(prev => prev.map(a => {
      if (a.id !== id) return a;
      const merged: Area = { ...a, ...newAreaData };
      const size = imageSize || undefined;

      // If bounds edited, recompute circle and then normalize bounds.
      if (newAreaData.topLeft || newAreaData.bottomRight) {
        let topLeft = merged.topLeft;
        let bottomRight = merged.bottomRight;

        if (size) {
          topLeft = { x: clamp(topLeft.x, 0, size.width), y: clamp(topLeft.y, 0, size.height) };
          bottomRight = { x: clamp(bottomRight.x, 0, size.width), y: clamp(bottomRight.y, 0, size.height) };
        }

        const circle = circleFromBounds(topLeft, bottomRight);
        const bounds = areaBoundsFromCircle(circle.center, circle.radius, size);
        return { ...merged, center: circle.center, radius: circle.radius, topLeft: bounds.topLeft, bottomRight: bounds.bottomRight };
      }

      // Otherwise, circle edited -> normalize bounds.
      const bounds = areaBoundsFromCircle(merged.center, merged.radius, size);
      return { ...merged, topLeft: bounds.topLeft, bottomRight: bounds.bottomRight };
    }));
  };

  const deleteSelected = () => {
    if (!selectedElement) return;
    if (selectedElement.type === 'marker') {
        const markerIdToDelete = selectedElement.id;
        const updatedMarkers = markers.map(m => ({
            ...m,
            linkedMarkerIds: m.linkedMarkerIds?.filter(id => id !== markerIdToDelete)
        }));
        setMarkers(updatedMarkers.filter(m => m.id !== markerIdToDelete));
        setPaths(paths.filter(p => p.linkedMarkers?.startId !== markerIdToDelete && p.linkedMarkers?.endId !== markerIdToDelete));
    } else if (selectedElement.type === 'path') {
        const pathToDelete = paths.find(p => p.id === selectedElement.id);
        if (pathToDelete?.linkedMarkers) {
          const fromMarker = markers.find(m => m.id === pathToDelete.linkedMarkers.startId);
          if(fromMarker) {
            updateMarker(fromMarker.id, {
              linkedMarkerIds: fromMarker.linkedMarkerIds?.filter(id => id !== pathToDelete.linkedMarkers.endId)
            });
          }
        }
        setPaths(paths.filter(p => p.id !== selectedElement.id));
    } else {
        setAreas(areas.filter(a => a.id !== selectedElement.id));
    }
    setSelectedElement(null);
  };
  
  const handleStartLinking = (fromMarkerId: string) => {
    setLinkingState({ fromMarkerId });
    setActiveTool('select');
  };
  
  const handleCancelLinking = () => {
    setLinkingState(null);
  };

  const handleLinkMarkers = (toMarkerId: string) => {
    if (!linkingState) return;
    const { fromMarkerId } = linkingState;

    if (fromMarkerId === toMarkerId) {
      setLinkingState(null);
      return;
    }
    
    const fromMarker = markers.find(m => m.id === fromMarkerId);
    const toMarker = markers.find(m => m.id === toMarkerId);

    if (fromMarker && toMarker) {
        const alreadyLinked = fromMarker.linkedMarkerIds?.includes(toMarkerId);
        if (alreadyLinked) {
            setLinkingState(null);
            return;
        }

        const newPath: Path = {
            id: `path-${fromMarkerId}-${toMarkerId}-${Date.now()}`,
            points: [fromMarker.position, toMarker.position],
            linkedMarkers: { startId: fromMarkerId, endId: toMarkerId },
            color: fromMarker.color // Inherit color from starting marker by default
        };
        
        const newMarkers = markers.map(m => m.id === fromMarkerId ? {
            ...m,
            linkedMarkerIds: [...(m.linkedMarkerIds || []), toMarkerId]
        } : m);
        
        setMarkers(newMarkers);
        setPaths([...paths, newPath]);
    }
    setLinkingState(null);
  };

  const handleRemoveLink = (fromMarkerId: string, toMarkerId: string) => {
      const fromMarker = markers.find(m => m.id === fromMarkerId);
      if (fromMarker) {
          updateMarker(fromMarkerId, {
              linkedMarkerIds: fromMarker.linkedMarkerIds?.filter(id => id !== toMarkerId)
          });
      }
      setPaths(paths.filter(p => !(p.linkedMarkers?.startId === fromMarkerId && p.linkedMarkers?.endId === toMarkerId)));
  };

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleCancelLinking();
            setDrawingPathId(null);
            setDrawingArea(null);
            setSelectedElement(null);
        }
        if (e.key === 'Enter') {
          setDrawingArea(null);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElement, markers, paths, areas]);

  const filteredMarkers = markers.filter(marker => {
    const color = marker.color || '#10b981';
    if (colorFilters[color] === false) return false;
    
    const area = marker.area || '';
    if (area && areaFilters[area] === false) return false;
    
    const number = marker.number || '';
    if (number && numberFilters[number] === false) return false;
    
    return true;
  });

  const visibleMarkerIds = new Set(filteredMarkers.map(m => m.id));

  const filteredPaths = paths.filter(path => {
    if (!path.linkedMarkers) {
      return true;
    }
    return visibleMarkerIds.has(path.linkedMarkers.startId) && visibleMarkerIds.has(path.linkedMarkers.endId);
  });

  return (
    <div className="flex h-screen w-screen bg-gray-800 font-sans">
      <Sidebar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onFileUpload={handleFileUpload}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onResetWorkspace={handleResetWorkspace}
        onExportPlan={handleExportPlan}
        onExportPng={handleExportPng}
        onExportLua={handleExportLua}
        selectedElement={selectedElement}
        markers={markers}
        paths={paths}
        areas={areas}
        updateMarker={updateMarker}
        updatePath={updatePath}
        updateArea={updateArea}
        deleteSelected={deleteSelected}
        linkingState={linkingState}
        onStartLinking={handleStartLinking}
        onRemoveLink={handleRemoveLink}
        onCancelLinking={handleCancelLinking}
        zoom={zoom}
        setZoom={setZoom}
        markerSize={markerSize}
        setMarkerSize={setMarkerSize}
        labelSize={labelSize}
        setLabelSize={setLabelSize}
        showMarkerLabels={showMarkerLabels}
        setShowMarkerLabels={setShowMarkerLabels}
        showAreaLabels={showAreaLabels}
        setShowAreaLabels={setShowAreaLabels}
        colorFilters={colorFilters}
        setColorFilters={setColorFilters}
        areaFilters={areaFilters}
        setAreaFilters={setAreaFilters}
        numberFilters={numberFilters}
        setNumberFilters={setNumberFilters}
      />
      <main className="flex-1 p-4 bg-gray-900 overflow-hidden">
        {image ? (
          <MapEditor
            imageSrc={image}
            imageSize={imageSize}
            markers={filteredMarkers}
            paths={filteredPaths}
            areas={areas}
            activeTool={activeTool}
            selectedElement={selectedElement}
            onAddMarker={addMarker}
            onAddPathPoint={addPathPoint}
            onAddAreaPoint={addAreaPoint}
            onUpdateMarker={updateMarker}
            onUpdatePath={updatePath}
            onUpdateArea={updateArea}
            onSelectElement={setSelectedElement}
            linkingState={linkingState}
            onLinkMarkers={handleLinkMarkers}
            onInsertPathPoint={insertPathPoint}
            drawingArea={drawingArea}
            zoom={zoom}
            markerSize={markerSize}
            labelSize={labelSize}
            showMarkerLabels={showMarkerLabels}
            showAreaLabels={showAreaLabels}
          />
        ) : (
          <div className="text-center text-gray-400">
            <h2 className="text-2xl font-bold">Welcome to the Map Planner</h2>
            <p className="mt-2">Please upload a map image or a .json plan file to begin.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
