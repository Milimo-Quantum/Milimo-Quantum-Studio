
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SaveIcon from './icons/SaveIcon';
import LoadIcon from './icons/LoadIcon';
import TrashIcon from './icons/TrashIcon';
import type { CircuitState } from '../types';

interface ProjectData {
    name: string;
    timestamp: number;
    data: CircuitState;
}

interface ProjectModalProps {
    isOpen: boolean;
    mode: 'save' | 'load';
    currentState: CircuitState;
    onClose: () => void;
    onLoadProject: (state: CircuitState) => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, mode, currentState, onClose, onLoadProject }) => {
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [projectName, setProjectName] = useState('');
    
    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('milimo_projects');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Convert map to array and sort by date desc
                    const projectList = Object.values(parsed) as ProjectData[];
                    setProjects(projectList.sort((a, b) => b.timestamp - a.timestamp));
                } catch (e) {
                    console.error("Failed to load projects", e);
                    setProjects([]);
                }
            }
            setProjectName('');
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!projectName.trim()) return;

        const newProject: ProjectData = {
            name: projectName.trim(),
            timestamp: Date.now(),
            data: currentState
        };

        const saved = localStorage.getItem('milimo_projects');
        let projectMap: Record<string, ProjectData> = saved ? JSON.parse(saved) : {};
        
        if (projectMap[newProject.name] && !confirm(`Overwrite existing project "${newProject.name}"?`)) {
            return;
        }

        projectMap[newProject.name] = newProject;
        localStorage.setItem('milimo_projects', JSON.stringify(projectMap));
        onClose();
    };

    const handleLoad = (project: ProjectData) => {
        if (confirm(`Load project "${project.name}"? Unsaved changes to the current circuit will be lost.`)) {
            onLoadProject(project.data);
            onClose();
        }
    };

    const handleDelete = (name: string) => {
        if (confirm(`Are you sure you want to delete "${name}"?`)) {
             const saved = localStorage.getItem('milimo_projects');
             if (saved) {
                 const projectMap = JSON.parse(saved);
                 delete projectMap[name];
                 localStorage.setItem('milimo_projects', JSON.stringify(projectMap));
                 setProjects(Object.values(projectMap).sort((a: any, b: any) => b.timestamp - a.timestamp));
             }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col font-sans"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/50">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        {mode === 'save' ? <SaveIcon className="w-5 h-5 text-cyan-400"/> : <LoadIcon className="w-5 h-5 text-green-400"/>}
                        {mode === 'save' ? 'Save Project' : 'Load Project'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6">
                    {mode === 'save' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2">Project Name</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="e.g., My Quantum Experiment"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                />
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={!projectName.trim()}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors"
                            >
                                Save Circuit
                            </button>
                        </div>
                    )}

                    {mode === 'load' && (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {projects.length === 0 ? (
                                <p className="text-center text-gray-500 py-8 text-sm">No saved projects found.</p>
                            ) : (
                                projects.map(p => (
                                    <div key={p.name} className="group flex items-center justify-between bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg p-3 transition-all">
                                        <div className="flex-1 cursor-pointer" onClick={() => handleLoad(p)}>
                                            <h3 className="text-gray-200 font-medium text-sm group-hover:text-cyan-300 transition-colors">{p.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(p.timestamp).toLocaleDateString()} • {p.data.numQubits} Qubits • {p.data.placedItems.length} Items
                                            </p>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                                            className="p-2 text-gray-600 hover:text-red-400 transition-colors"
                                            title="Delete Project"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ProjectModal;
