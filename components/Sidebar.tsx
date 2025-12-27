
import React from 'react';
import { Marker, MarkerStatus, Path, Tool } from '../types.ts';
import { SelectIcon, MarkerIcon, PathIcon, DeleteIcon, LinkIcon, ResetIcon, ExportIcon } from './icons.tsx';

interface SidebarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  onFileUpload: (file: File) => void;
  onResetWorkspace: () => void;
  onExportPlan: () => void;
  selectedElement: { type: 'marker' | 'path'; id: string } | null;
  markers: Marker[];
  paths: Path[];
  updateMarker: (id: string, data: Partial<Marker>) => void;
  updatePath: (id: string, data: Partial<Path>) => void;
  deleteSelected: () => void;
  linkingState: { fromMarkerId: string } | null;
  onStartLinking: (fromMarkerId: string) => void;
  onRemoveLink: (fromMarkerId: string, toMarkerId: string) => void;
  onCancelLinking: () => void;
  zoom: number;
  setZoom: (zoom: number | ((prevZoom: number) => number)) => void;
  showMarkerLabels: boolean;
  setShowMarkerLabels: (show: boolean | ((prev: boolean) => boolean)) => void;
  colorFilters: Record<string, boolean>;
  setColorFilters: (filters: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTool,
  setActiveTool,
  onFileUpload,
  onResetWorkspace,
  onExportPlan,
  selectedElement,
  markers,
  paths,
  updateMarker,
  updatePath,
  deleteSelected,
  linkingState,
  onStartLinking,
  onRemoveLink,
  onCancelLinking,
  zoom,
  setZoom,
  showMarkerLabels,
  setShowMarkerLabels,
  colorFilters,
  setColorFilters,
}) => {
    const selectedMarker = selectedElement?.type === 'marker'
    ? markers.find(m => m.id === selectedElement.id)
    : null;

    const selectedPath = selectedElement?.type === 'path'
    ? paths.find(p => p.id === selectedElement.id)
    : null;
    
    const uniqueColors = Array.from(new Set(markers.map(m => m.color || '#10b981')));


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = ''; // Reset input to allow re-uploading the same file
    }
  };
  
  const ToolButton = ({ tool, label, children }: React.PropsWithChildren<{ tool: Tool; label: string; }>) => (
    <button
      onClick={() => setActiveTool(tool)}
      className={`flex items-center space-x-2 w-full p-2 rounded-md text-left transition-colors ${
        activeTool === tool ? 'bg-sky-600 text-white' : 'hover:bg-gray-700'
      }`}
      title={label}
    >
      {children}
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="w-80 bg-gray-800 p-4 flex flex-col h-full shadow-lg border-r border-gray-700">
      <h1 className="text-2xl font-bold text-sky-400 mb-6">Map Planner</h1>

      <div className="mb-6">
        <label htmlFor="map-upload" className="w-full inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md cursor-pointer text-center transition-colors">
          Load Map or Plan
        </label>
        <input id="map-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/bmp, .json, application/json" onChange={handleFileChange} />
      </div>

      <div className="space-y-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-300">View Options</h2>
        <div className="flex items-center justify-between space-x-2 text-sm">
            <span className="font-medium text-gray-300">Zoom</span>
            <div className="flex items-center space-x-1 bg-gray-900 rounded-md p-1">
                <button
                    onClick={() => setZoom(z => Math.max(0.1, z / 1.2))}
                    className="px-2 py-1 rounded-md hover:bg-gray-700 transition-colors w-8"
                    title="Zoom Out"
                >
                    -
                </button>
                <span
                    onClick={() => setZoom(1)}
                    className="w-16 text-center tabular-nums cursor-pointer"
                    title="Reset Zoom"
                >
                    {Math.round(zoom * 100)}%
                </span>
                <button
                    onClick={() => setZoom(z => Math.min(5, z * 1.2))}
                    className="px-2 py-1 rounded-md hover:bg-gray-700 transition-colors w-8"
                    title="Zoom In"
                >
                    +
                </button>
            </div>
        </div>
        <div className="flex items-center justify-between space-x-2 text-sm">
            <label htmlFor="show-labels-toggle" className="font-medium text-gray-300">Show Labels</label>
            <label htmlFor="show-labels-toggle" className="flex items-center cursor-pointer">
              <div className="relative">
                  <input type="checkbox" id="show-labels-toggle" className="sr-only" checked={showMarkerLabels} onChange={() => setShowMarkerLabels(v => !v)} />
                  <div className="block bg-gray-600 w-10 h-5 rounded-full"></div>
                  <div className={`dot absolute left-1 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${showMarkerLabels ? 'translate-x-5' : ''}`}></div>
              </div>
            </label>
        </div>
      </div>

      <div className="space-y-3 mb-4 border-t border-gray-700 pt-4">
        <h2 className="text-lg font-semibold text-gray-300">Filters</h2>
        <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">By Color</h3>
            <div className="flex flex-wrap gap-2">
                {uniqueColors.length > 0 ? uniqueColors.map((color: string) => (
                    <button
                        key={color}
                        onClick={() => {
                            setColorFilters(prev => ({ ...prev, [color]: !prev[color] }));
                        }}
                        className={`h-6 w-6 rounded-full border-2 transition-all ${colorFilters[color] !== false ? 'border-sky-400' : 'border-transparent opacity-40'}`}
                        style={{ backgroundColor: color }}
                        title={`Toggle ${color}`}
                    />
                )) : <p className="text-xs text-gray-500">No markers to filter.</p>}
            </div>
        </div>
      </div>


      <div className="space-y-2 mb-6 border-t border-gray-700 pt-4">
        <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-gray-300">Tools</h2>
            <div className="flex space-x-4">
                <button onClick={onExportPlan} className="flex items-center space-x-2 text-xs text-gray-400 hover:text-white transition-colors" title="Export Plan">
                    <ExportIcon />
                    <span>Export</span>
                </button>
                <button onClick={onResetWorkspace} className="flex items-center space-x-2 text-xs text-gray-400 hover:text-white transition-colors" title="Reset Workspace">
                    <ResetIcon />
                    <span>Reset</span>
                </button>
            </div>
        </div>
        <ToolButton tool="select" label="Select & Move"><SelectIcon /></ToolButton>
        <ToolButton tool="marker" label="Add Marker"><MarkerIcon /></ToolButton>
        <ToolButton tool="path" label="Draw Path"><PathIcon /></ToolButton>
      </div>
      
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 border-t border-gray-700 pt-4">
        {linkingState && (
          <div className="bg-sky-900/50 p-4 rounded-md mb-4 border border-sky-500 text-center">
            <p className="text-sky-300 font-semibold">Linking Mission...</p>
            <p className="text-sm text-sky-400">Select another marker on the map.</p>
            <button onClick={onCancelLinking} className="mt-2 text-xs text-gray-300 hover:text-white">Cancel (Esc)</button>
          </div>
        )}
        {selectedMarker ? (
          <div className="bg-gray-700/50 p-4 rounded-md">
            <h3 className="text-lg font-bold text-sky-400 mb-3">Edit Marker</h3>
            <div className="space-y-4">
               <div>
                 <label htmlFor="marker-number" className="block text-sm font-medium text-gray-300">Number</label>
                 <input type="text" id="marker-number" value={selectedMarker.number || ''} onChange={(e) => updateMarker(selectedMarker.id, { number: e.target.value })}
                   className="mt-1 w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-white focus:ring-sky-500 focus:border-sky-500" />
               </div>
               <div>
                 <label htmlFor="marker-name" className="block text-sm font-medium text-gray-300">Name</label>
                 <input type="text" id="marker-name" value={selectedMarker.name} onChange={(e) => updateMarker(selectedMarker.id, { name: e.target.value })}
                   className="mt-1 w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-white focus:ring-sky-500 focus:border-sky-500" />
               </div>
               <div className="flex items-center justify-between">
                 <label htmlFor="marker-status" className="block text-sm font-medium text-gray-300">Status</label>
                 <select id="marker-status" value={selectedMarker.status} onChange={(e) => updateMarker(selectedMarker.id, { status: e.target.value as MarkerStatus })}
                   className="mt-1 w-2/3 bg-gray-800 border border-gray-600 rounded-md p-2 text-white focus:ring-sky-500 focus:border-sky-500">
                   <option value="pending">Pending</option>
                   <option value="active">Active</option>
                   <option value="completed">Completed</option>
                 </select>
               </div>
               <div className="flex items-center justify-between">
                <label htmlFor="marker-color" className="block text-sm font-medium text-gray-300">Marker Color</label>
                <input type="color" id="marker-color" value={selectedMarker.color || '#10b981'} onChange={(e) => updateMarker(selectedMarker.id, { color: e.target.value })}
                    className="w-10 h-10 p-1 bg-gray-800 border border-gray-600 rounded-md cursor-pointer" />
               </div>

              <div>
                <h4 className="text-md font-semibold text-gray-300 mb-2">Linked Missions</h4>
                <div className="space-y-2">
                    {selectedMarker.linkedMarkerIds?.length ? selectedMarker.linkedMarkerIds.map(linkedId => {
                        const linkedMarker = markers.find(m => m.id === linkedId);
                        return (
                          <div key={linkedId} className="flex items-center justify-between bg-gray-800 p-2 rounded-md">
                            <span className="text-sm text-gray-200 truncate pr-2">{linkedMarker?.name || 'Unknown Marker'}</span>
                            <button onClick={() => onRemoveLink(selectedMarker.id, linkedId)} className="text-red-400 hover:text-red-300 flex-shrink-0" title="Remove link"><DeleteIcon/></button>
                          </div>
                        )
                    }) : <p className="text-xs text-gray-400">No linked missions.</p>}
                </div>
                <button onClick={() => onStartLinking(selectedMarker.id)} className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    <LinkIcon/><span>Add Link</span>
                </button>
              </div>

               <button onClick={deleteSelected} className="w-full mt-4 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                 <DeleteIcon /><span>Delete Marker</span>
               </button>
            </div>
          </div>
        ) : selectedPath ? (
             <div className="bg-gray-700/50 p-4 rounded-md">
                <h3 className="text-lg font-bold text-amber-400 mb-3">Path Selected</h3>
                <div className="flex items-center justify-between mb-4">
                    <label htmlFor="path-color" className="block text-sm font-medium text-gray-300">Path Color</label>
                    <input type="color" id="path-color" value={selectedPath.color || '#f59e0b'} onChange={(e) => updatePath(selectedPath.id, { color: e.target.value })}
                        className="w-10 h-10 p-1 bg-gray-800 border border-gray-600 rounded-md cursor-pointer" />
                </div>
                {selectedPath.linkedMarkers && (
                    <p className="text-gray-400 text-xs mb-3">This path connects two missions. You can give it a unique color.</p>
                )}
                <p className="text-gray-300 text-sm mb-3">Drag the main handles to move points. Drag the smaller handles that appear between points to create a new bend.</p>
                <button onClick={deleteSelected} className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                 <DeleteIcon /><span>Delete Path</span>
               </button>
            </div>
        ) : (
            <div className="text-gray-400 text-center p-4 border-2 border-dashed border-gray-600 rounded-md">
                <p>Select an element on the map to edit its properties.</p>
            </div>
        )}
      </div>
    </aside>
  );
};