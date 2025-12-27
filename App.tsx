
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { MapEditor } from './components/MapEditor.tsx';
import { Marker, Path, Point, Tool } from './types.ts';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedElement, setSelectedElement] = useState<{ type: 'marker' | 'path'; id: string } | null>(null);
  const [linkingState, setLinkingState] = useState<{ fromMarkerId: string } | null>(null);
  const [drawingPathId, setDrawingPathId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showMarkerLabels, setShowMarkerLabels] = useState(true);
  const [colorFilters, setColorFilters] = useState<Record<string, boolean>>({});

  // Load state from localStorage on initial render
  useEffect(() => {
    const savedState = localStorage.getItem('dungeonMapState');
    if (savedState) {
      try {
        const { image, markers, paths } = JSON.parse(savedState);
        setImage(image);
        setMarkers(markers || []);
        setPaths(paths || []);
      } catch (error) {
        console.error("Failed to parse saved state:", error);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (image) {
      try {
        const stateToSave = { image, markers, paths };
        localStorage.setItem('dungeonMapState', JSON.stringify(stateToSave));
      } catch (error) {
        console.error("Failed to save state:", error);
      }
    }
  }, [image, markers, paths]);
  
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
          const { image, markers, paths } = JSON.parse(text);
          if (image && Array.isArray(markers) && Array.isArray(paths)) {
            setImage(image);
            setMarkers(markers);
            setPaths(paths);
            setSelectedElement(null);
            setLinkingState(null);
            setDrawingPathId(null);
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
        setSelectedElement(null);
        setLinkingState(null);
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
    const stateToSave = { image, markers, paths };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dungeon-plan.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetWorkspace = () => {
    localStorage.removeItem('dungeonMapState');
    setImage(null);
    setMarkers([]);
    setPaths([]);
    setSelectedElement(null);
    setLinkingState(null);
    setDrawingPathId(null);
    setZoom(1);
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
    } else {
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
            setSelectedElement(null);
        }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, []);

  const filteredMarkers = markers.filter(marker => {
    const color = marker.color || '#10b981';
    return colorFilters[color] !== false;
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
        onResetWorkspace={handleResetWorkspace}
        onExportPlan={handleExportPlan}
        selectedElement={selectedElement}
        markers={markers}
        paths={paths}
        updateMarker={updateMarker}
        updatePath={updatePath}
        deleteSelected={deleteSelected}
        linkingState={linkingState}
        onStartLinking={handleStartLinking}
        onRemoveLink={handleRemoveLink}
        onCancelLinking={handleCancelLinking}
        zoom={zoom}
        setZoom={setZoom}
        showMarkerLabels={showMarkerLabels}
        setShowMarkerLabels={setShowMarkerLabels}
        colorFilters={colorFilters}
        setColorFilters={setColorFilters}
      />
      <main className="flex-1 p-4 bg-gray-900 overflow-hidden">
        {image ? (
          <MapEditor
            imageSrc={image}
            markers={filteredMarkers}
            paths={filteredPaths}
            activeTool={activeTool}
            selectedElement={selectedElement}
            onAddMarker={addMarker}
            onAddPathPoint={addPathPoint}
            onUpdateMarker={updateMarker}
            onUpdatePath={updatePath}
            onSelectElement={setSelectedElement}
            linkingState={linkingState}
            onLinkMarkers={handleLinkMarkers}
            onInsertPathPoint={insertPathPoint}
            zoom={zoom}
            showMarkerLabels={showMarkerLabels}
          />
        ) : (
          <div className="text-center text-gray-400">
            <h2 className="text-2xl font-bold">Welcome to the Dungeon Map Planner</h2>
            <p className="mt-2">Please upload a map image or a .json plan file to begin.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;