import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import type { SimulationResult } from '../types';
import LogoIcon from './icons/LogoIcon';
import NoiseIcon from './icons/NoiseIcon';
import InfoIcon from './icons/InfoIcon';

const SPHERE_SIZE = 220;
const RADIUS = SPHERE_SIZE / 2;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const BlochSphere: React.FC<{ x: number; y: number; z: number }> = ({ x, y, z }) => {
  const [isDragging, setIsDragging] = useState(false);
  const sphereRef = useRef<HTMLDivElement>(null);
  
  const rotX = useSpring(0, { stiffness: 300, damping: 30 });
  const rotY = useSpring(0, { stiffness: 300, damping: 30 });

  useEffect(() => {
    // Initial orientation
    rotX.set(-25);
    rotY.set(25);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    const startX = e.pageX - rotY.get();
    const startY = e.pageY - rotX.get();

    const handlePointerMove = (moveEvent: PointerEvent) => {
        rotY.set(moveEvent.pageX - startX);
        rotX.set(moveEvent.pageY - startY);
    };

    const handlePointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const vectorLength = Math.sqrt(x * x + y * y + z * z);
  // Spherical coordinates from Cartesian
  const phi = Math.atan2(y, x);
  
  const clampedZ = clamp(z / (vectorLength || 1), -1, 1);
  const theta = Math.acos(clampedZ); // Polar angle (from z-axis)

  return (
    <div
      ref={sphereRef}
      className="relative w-full flex items-center justify-center select-none"
      style={{ perspective: '800px', cursor: isDragging ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
    >
      <motion.div
        className="relative"
        style={{
          width: SPHERE_SIZE,
          height: SPHERE_SIZE,
          transformStyle: 'preserve-3d',
          rotateX: rotX,
          rotateY: rotY,
        }}
      >
        {/* Sphere body */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage: 'radial-gradient(circle at 65% 15%, hsla(0,0%,100%,.2) 1px, hsla(210,50%,20%,.2) 40%, hsla(220,50%,10%,0) 60%)',
            boxShadow: 'inset 0 0 40px hsla(220,50%,10%,.8)',
            transformStyle: 'preserve-3d',
          }}
        />
        {/* Equator */}
        <div className="absolute inset-0 rounded-full border border-cyan-400/20" style={{ transform: 'rotateX(90deg)' }} />
        {/* Prime Meridian */}
        <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
        
        {/* State Vector */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-1 origin-top"
          style={{
            transformStyle: 'preserve-3d',
            height: RADIUS,
          }}
          initial={{ rotateZ: 0, rotateY: 0 }}
          animate={{
              rotateZ: phi * (180 / Math.PI),
              rotateY: theta * (180 / Math.PI),
          }}
          transition={{type: 'spring', stiffness: 200, damping: 20}}
        >
            <motion.div
                className="w-full bg-gradient-to-t from-purple-400 to-purple-300"
                style={{ transformStyle: 'preserve-3d' }}
                initial={{height: '100%'}}
                animate={{height: `${vectorLength * 100}%`}}
                transition={{type: 'spring', stiffness: 200, damping: 20}}
            >
              {/* Arrowhead */}
              <div
                className="absolute -top-px left-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-purple-200"
                style={{ transform: 'translateX(-50%) rotateX(90deg) translateZ(5px)'}}
              />
            </motion.div>
        </motion.div>

        {/* Labels */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-cyan-300 text-xs">|0⟩</div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full text-cyan-300 text-xs">|1⟩</div>
        <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-full text-gray-500 text-xs">|-⟩</div>
        <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full text-gray-500 text-xs">|+⟩</div>

      </motion.div>
    </div>
  );
};

const NoiseSlider: React.FC<{
    label: string;
    description: string;
    value: number;
    setValue: (val: number) => void;
}> = ({ label, description, value, setValue }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-400 flex items-center gap-1.5">
                {label}
                 <div className="group relative">
                    <InfoIcon className="w-3 h-3 text-gray-500" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-gray-900 border border-gray-700 rounded-md text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                        {description}
                    </div>
                </div>
            </label>
            <span className="text-xs text-gray-200 w-10 text-right">{(value * 100).toFixed(0)}%</span>
        </div>
        <input
            type="range"
            min="0"
            max="0.1"
            step="0.005"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm"
        />
    </div>
);


interface VisualizationPanelProps {
  result: SimulationResult | null;
  visualizedQubit: number;
  numQubits: number;
  depolarizingError: number;
  setDepolarizingError: (value: number) => void;
  phaseDampingError: number;
  setPhaseDampingError: (value: number) => void;
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ result, visualizedQubit, depolarizingError, setDepolarizingError, phaseDampingError, setPhaseDampingError }) => {
  const [isNoisePanelOpen, setIsNoisePanelOpen] = useState(false);
  const hasResult = result && result.probabilities.length > 0;

  const visualizedQubitState = useMemo(() => {
    if (!hasResult) return null;
    return result.qubitStates[visualizedQubit];
  }, [result, visualizedQubit, hasResult]);
  
  return (
    <motion.div
      key="visualization"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 overflow-y-auto flex flex-col gap-6 text-sm text-gray-300 font-['IBM_Plex_Mono']"
    >
      {!hasResult ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <LogoIcon className="w-16 h-16 text-gray-700 mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-['Space_Grotesk']">No Simulation Data</h3>
            <p className="max-w-xs mt-1">Place a gate on the canvas to begin the simulation.</p>
        </div>
      ) : (
        <>
            <div>
                <h3 className="text-gray-400 mb-1">Bloch Sphere (q[{visualizedQubit}])</h3>
                <p className="text-xs text-gray-500 mb-3">Purity: {visualizedQubitState?.purity.toFixed(3)}</p>
                <div className="w-full aspect-square bg-gray-800/20 border border-gray-600/30 rounded-lg flex items-center justify-center p-4">
                    {visualizedQubitState && <BlochSphere {...visualizedQubitState.blochSphereCoords} />}
                </div>
                <p className="text-center text-xs text-gray-500 mt-2">Click and drag to rotate the sphere.</p>
            </div>

            <div>
                 <button onClick={() => setIsNoisePanelOpen(p => !p)} className="w-full flex justify-between items-center text-gray-400 mb-3">
                    <div className="flex items-center gap-2">
                        <NoiseIcon className="w-4 h-4" />
                        Noise Models
                    </div>
                     <svg className={`w-4 h-4 transition-transform ${isNoisePanelOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                 </button>
                 <AnimatePresence>
                 {isNoisePanelOpen && (
                     <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                     >
                        <div className="p-4 bg-gray-800/20 border border-gray-600/30 rounded-lg space-y-4 mb-4">
                            <NoiseSlider 
                                label="Depolarizing Error"
                                description="Simulates random bit-flip (X), phase-flip (Z), or both (Y) errors occurring after each gate operation."
                                value={depolarizingError}
                                setValue={setDepolarizingError}
                            />
                             <NoiseSlider 
                                label="Phase Damping"
                                description="Simulates decoherence, the loss of quantum information to the environment over time, causing superposition to decay."
                                value={phaseDampingError}
                                setValue={setPhaseDampingError}
                            />
                        </div>
                     </motion.div>
                 )}
                 </AnimatePresence>
            </div>

             <div>
                <h3 className="text-gray-400 mb-3">Measurement Probabilities</h3>
                <div className="space-y-2">
                {result.probabilities.map(p => (
                    <div key={p.state} className="flex items-center gap-3">
                    <span className="w-20 text-right text-gray-500">{p.state}</span>
                    <div className="flex-grow bg-gray-700/50 rounded-full h-4 overflow-hidden">
                        <motion.div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${p.value * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                    <span className="w-12 text-left">{`${(p.value * 100).toFixed(1)}%`}</span>
                    </div>
                ))}
                </div>
            </div>
        </>
      )}
    </motion.div>
  );
};

export default VisualizationPanel;