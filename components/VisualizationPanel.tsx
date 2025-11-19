
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import type { SimulationResult } from '../types';
import LogoIcon from './icons/LogoIcon';
import NoiseIcon from './icons/NoiseIcon';
import InfoIcon from './icons/InfoIcon';
import ChipIcon from './icons/ChipIcon';

const SPHERE_SIZE = 220;
const RADIUS = SPHERE_SIZE / 2;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toSpherical = (x: number, y: number, z: number) => {
    const r = Math.sqrt(x*x + y*y + z*z);
    if (r === 0) return { theta: 0, phi: 0, r: 0 };
    
    const clampedZ = clamp(z / r, -1, 1);
    const theta = Math.acos(clampedZ); // Polar angle (from z-axis) 0 to PI
    const phi = Math.atan2(y, x); // Azimuthal angle -PI to PI
    
    return { theta, phi, r };
};

// Helper to get shortest rotation path for phi to avoid spinning the long way
const getShortestDelta = (start: number, end: number) => {
    let delta = end - start;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return delta;
};

const GhostVector: React.FC<{ theta: number, phi: number, opacity: number, r: number }> = ({ theta, phi, opacity, r }) => (
    <motion.div
        className="absolute top-1/2 left-1/2 w-0.5 origin-top bg-cyan-400/50 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity }}
        exit={{ opacity: 0 }}
        style={{
            height: RADIUS * r,
            transformStyle: 'preserve-3d',
            transform: `rotateZ(${phi}rad) rotateY(${theta}rad)`,
            boxShadow: `0 0 8px rgba(34, 211, 238, ${opacity})`
        }}
    />
);


const BlochSphere: React.FC<{ x: number; y: number; z: number }> = ({ x, y, z }) => {
  const [isDragging, setIsDragging] = useState(false);
  const sphereRef = useRef<HTMLDivElement>(null);
  
  // View rotation (user dragging)
  const viewRotX = useSpring(0, { stiffness: 300, damping: 30 });
  const viewRotY = useSpring(0, { stiffness: 300, damping: 30 });

  // Vector animation state
  const vectorTheta = useSpring(0, { stiffness: 120, damping: 14 });
  const vectorPhi = useSpring(0, { stiffness: 120, damping: 14 });
  const vectorLength = useSpring(0, { stiffness: 120, damping: 14 });
  
  // Transform length to percentage for height style
  const vectorHeight = useTransform(vectorLength, (l) => `${l * 100}%`);

  // Ghost trails state
  const [ghosts, setGhosts] = useState<Array<{theta: number, phi: number, id: number}>>([]);

  // Internal refs to track previous state for interpolation
  const prevCoords = useRef({ theta: 0, phi: 0 });
  
  useEffect(() => {
    // Initial orientation
    viewRotX.set(-25);
    viewRotY.set(25);
  }, []);

  useEffect(() => {
      const { theta, phi, r } = toSpherical(x, y, z);
      
      // Calculate shortest path for Phi
      const currentPhi = prevCoords.current.phi;
      const deltaPhi = getShortestDelta(currentPhi, phi);
      const targetPhi = currentPhi + deltaPhi;

      // Generate ghosts if the move is significant
      const dist = Math.abs(deltaPhi) + Math.abs(theta - prevCoords.current.theta);
      
      if (dist > 0.1) {
          const numGhosts = 5;
          const newGhosts = [];
          for(let i = 1; i < numGhosts; i++) {
              const t = i / numGhosts;
              newGhosts.push({
                  theta: prevCoords.current.theta + (theta - prevCoords.current.theta) * t,
                  phi: currentPhi + deltaPhi * t,
                  id: Date.now() + i
              });
          }
          setGhosts(newGhosts);
          
          // Clear ghosts after animation
          setTimeout(() => setGhosts([]), 400);
      }

      // Update springs
      vectorTheta.set(theta);
      vectorPhi.set(targetPhi);
      vectorLength.set(r);
      
      // Update ref (normalize phi back to -PI, PI range for stability)
      prevCoords.current = { theta, phi }; // Store canonical phi for next calc

  }, [x, y, z]);


  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    const startX = e.pageX - viewRotY.get();
    const startY = e.pageY - viewRotX.get();

    const handlePointerMove = (moveEvent: PointerEvent) => {
        viewRotY.set(moveEvent.pageX - startX);
        viewRotX.set(moveEvent.pageY - startY);
    };

    const handlePointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

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
          rotateX: viewRotX,
          rotateY: viewRotY,
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
        
        {/* Ghost Trails */}
        <AnimatePresence>
            {ghosts.map(g => (
                <GhostVector key={g.id} theta={g.theta} phi={g.phi} opacity={0.3} r={1} />
            ))}
        </AnimatePresence>

        {/* State Vector */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-1 origin-top"
          style={{
            transformStyle: 'preserve-3d',
            height: RADIUS,
            rotateZ: vectorPhi, // Use spring values directly
            rotateY: vectorTheta,
          }}
        >
            <motion.div
                className="w-full bg-gradient-to-t from-purple-500 via-purple-400 to-white"
                style={{ 
                    transformStyle: 'preserve-3d',
                    boxShadow: '0 0 10px rgba(168, 85, 247, 0.5)',
                    height: vectorHeight
                }}
                initial={{height: '0%'}}
            >
              {/* Arrowhead */}
              <div
                className="absolute -top-px left-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-white"
                style={{ transform: 'translateX(-50%) rotateX(90deg) translateZ(5px)'}}
              />
            </motion.div>
        </motion.div>

        {/* Labels */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-cyan-300 text-xs font-mono font-bold">|0⟩</div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full text-cyan-300 text-xs font-mono font-bold">|1⟩</div>
        <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-full text-gray-500 text-xs font-mono">|-⟩</div>
        <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full text-gray-500 text-xs font-mono">|+⟩</div>

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

const ProbabilityBars: React.FC<{ probabilities: SimulationResult['probabilities'] }> = ({ probabilities }) => (
    <div className="space-y-2">
        {probabilities.map(p => (
            <div key={p.state} className="flex items-center gap-3">
                <span className="w-20 text-right text-gray-500 font-mono">{p.state}</span>
                <div className="flex-grow bg-gray-700/50 rounded-full h-4 overflow-hidden">
                    <motion.div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${p.value * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                </div>
                <span className="w-12 text-left font-mono">{`${(p.value * 100).toFixed(1)}%`}</span>
            </div>
        ))}
    </div>
);

const StateDisplay: React.FC<{ x: number, y: number, z: number }> = ({ x, y, z }) => {
    // Approximate alpha/beta from Bloch coordinates for pure states
    // r, theta, phi were calculated in BlochSphere, but we recalculate here for the text display
    const { theta, phi } = toSpherical(x, y, z);
    
    // |psi> = cos(theta/2)|0> + e^(i*phi)sin(theta/2)|1>
    const alphaRe = Math.cos(theta / 2);
    const betaMag = Math.sin(theta / 2);
    // e^(i*phi) = cos(phi) + i*sin(phi)
    const betaRe = betaMag * Math.cos(phi);
    const betaIm = betaMag * Math.sin(phi);

    const formatComplex = (re: number, im: number) => {
        const reStr = Math.abs(re) < 0.001 ? '0' : re.toFixed(2);
        const imStr = Math.abs(im) < 0.001 ? '0' : Math.abs(im).toFixed(2);
        const sign = im < 0 ? '-' : '+';
        
        if (reStr === '0' && imStr === '0') return '0';
        if (reStr === '0') return `${sign === '-' ? '-' : ''}${imStr}i`;
        if (imStr === '0') return reStr;
        return `${reStr} ${sign} ${imStr}i`;
    };

    return (
        <div className="bg-gray-800/40 border border-purple-500/20 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">State Vector Approximation</p>
            <div className="font-mono text-sm text-purple-200">
                |ψ⟩ ≈ <span className="text-white">{formatComplex(alphaRe, 0)}</span>|0⟩ + <span className="text-white">{formatComplex(betaRe, betaIm)}</span>|1⟩
            </div>
             <p className="text-[10px] text-gray-600 mt-1">Global phase ignored</p>
        </div>
    )
}


interface VisualizationPanelProps {
  result: SimulationResult | null;
  visualizedQubit: number;
  numQubits: number;
  depolarizingError: number;
  setDepolarizingError: (value: number) => void;
  phaseDampingError: number;
  setPhaseDampingError: (value: number) => void;
  hardwareResult: SimulationResult | null;
  isHardwareRunning: boolean;
}

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ result, visualizedQubit, numQubits, depolarizingError, setDepolarizingError, phaseDampingError, setPhaseDampingError, hardwareResult, isHardwareRunning }) => {
  const [isNoisePanelOpen, setIsNoisePanelOpen] = useState(false);
  
  // Check for "High Performance Mode" (Too many qubits for live browser simulation)
  const isThrottled = numQubits > 15;
  const hasResult = result && result.probabilities.length > 0;

  const visualizedQubitState = useMemo(() => {
    if (!hasResult) return null;
    return result.qubitStates[visualizedQubit];
  }, [result, visualizedQubit, hasResult]);
  
  // If we are throttled and no hardware result is present, show the performance warning
  if (isThrottled && !hardwareResult && !isHardwareRunning) {
      return (
        <motion.div
            key="visualization-throttled"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 font-['IBM_Plex_Mono']"
        >
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 border border-yellow-500/30">
                <ChipIcon className="w-8 h-8 text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-yellow-400 font-['Space_Grotesk'] mb-2">High Performance Mode</h3>
            <p className="text-sm text-gray-400 max-w-xs mb-6">
                Your circuit ({numQubits} qubits) is too large for live browser simulation.
            </p>
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 text-left space-y-3 max-w-sm">
                <div className="flex items-start gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                    <p className="text-xs text-gray-300">Use the <strong>Hardware</strong> tab to run this circuit on a cloud simulator or real quantum processor.</p>
                </div>
                <div className="flex items-start gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                    <p className="text-xs text-gray-300">Use the <strong>Code</strong> tab to export to Qiskit or Cirq.</p>
                </div>
            </div>
        </motion.div>
      );
  }

  return (
    <motion.div
      key="visualization"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 overflow-y-auto flex flex-col gap-6 text-sm text-gray-300 font-['IBM_Plex_Mono'] custom-scrollbar"
    >
      {!hasResult && !isHardwareRunning && !hardwareResult && !isThrottled ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <LogoIcon className="w-16 h-16 text-gray-700 mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-['Space_Grotesk']">No Simulation Data</h3>
            <p className="max-w-xs mt-1">Place a gate on the canvas to begin the simulation.</p>
        </div>
      ) : (
        <>
            {/* Only show Bloch sphere if we have a valid local simulation result (meaning < 15 qubits) */}
            {hasResult && (
            <div>
                <div className="flex justify-between items-end mb-2">
                    <h3 className="text-gray-400">Bloch Sphere (q[{visualizedQubit}])</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${visualizedQubitState && visualizedQubitState.purity > 0.99 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        Purity: {visualizedQubitState?.purity.toFixed(3)}
                    </span>
                </div>
                
                <div className="w-full bg-gray-800/20 border border-gray-600/30 rounded-lg flex flex-col items-center justify-center p-6 gap-4 relative overflow-hidden">
                    {/* Subtle background grid for 3D feel */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" 
                         style={{ backgroundImage: 'radial-gradient(circle at center, #444 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
                    />
                    
                    {visualizedQubitState && <BlochSphere {...visualizedQubitState.blochSphereCoords} />}
                    
                    {visualizedQubitState && (
                        <StateDisplay {...visualizedQubitState.blochSphereCoords} />
                    )}
                </div>
                <p className="text-center text-xs text-gray-500 mt-2">The vector traces its path when gates change.</p>
            </div>
            )}

            {!isThrottled && (
            <div>
                 <button onClick={() => setIsNoisePanelOpen(p => !p)} className="w-full flex justify-between items-center text-gray-400 mb-3 group hover:text-white transition-colors">
                    <div className="flex items-center gap-2">
                        <NoiseIcon className="w-4 h-4" />
                        Noise Models (Realism)
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
            )}

             <div>
                <h3 className="text-gray-400 mb-3">Measurement Probabilities</h3>
                <div className="border border-gray-500/20 rounded-lg p-4 bg-black/20">
                    {hasResult ? (
                        <>
                        <h4 className="text-xs text-cyan-300 mb-3 uppercase tracking-wider">Ideal Simulation</h4>
                        <ProbabilityBars probabilities={result.probabilities} />
                        </>
                    ) : (!isThrottled && (
                        <div className="animate-pulse text-xs text-gray-500 mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></div>
                            Calculating ideal simulation...
                        </div>
                    ))}

                    <AnimatePresence>
                    {(isHardwareRunning || hardwareResult) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={hasResult ? "mt-4" : ""}
                        >
                            {(hasResult || !isThrottled) && <div className="h-px bg-gray-700/50 my-4"></div>}
                            <h4 className="text-xs text-purple-300 mb-3 uppercase tracking-wider">Hardware Run Results</h4>
                            {isHardwareRunning && !hardwareResult && (
                                <div className="flex items-center justify-center h-24 text-gray-500">
                                    <div className="flex gap-1.5 items-center">
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></span>
                                        <span className="ml-2 text-xs">Running on backend...</span>
                                    </div>
                                </div>
                            )}
                            {hardwareResult && <ProbabilityBars probabilities={hardwareResult.probabilities} />}
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>
            </div>
        </>
      )}
    </motion.div>
  );
};

export default VisualizationPanel;
