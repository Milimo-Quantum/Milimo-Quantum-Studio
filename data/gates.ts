import type { QuantumGate } from '../types';
import HadamardGateIcon from '../components/icons/HadamardGateIcon';
import CNOTGateIcon from '../components/icons/CNOTGateIcon';
import PauliXGateIcon from '../components/icons/PauliXGateIcon';
import PauliYGateIcon from '../components/icons/PauliYGateIcon';
import PauliZGateIcon from '../components/icons/PauliZGateIcon';
import SGateIcon from '../components/icons/SGateIcon';
import SDaggerGateIcon from '../components/icons/SDaggerGateIcon';
import TGateIcon from '../components/icons/TGateIcon';
import TDaggerGateIcon from '../components/icons/TDaggerGateIcon';
import MeasurementGateIcon from '../components/icons/MeasurementGateIcon';
import SwapTargetIcon from '../components/icons/SwapTargetIcon';
import RXGateIcon from '../components/icons/RXGateIcon';
import RYGateIcon from '../components/icons/RYGateIcon';
import RZGateIcon from '../components/icons/RZGateIcon';

// For CNOT, CZ, and SWAP, the icon property is used for the draggable component in the left panel.
// The actual rendering on the canvas is custom logic in CircuitCanvas.tsx.
// A representative icon is used here for the side panel.
export const gates: QuantumGate[] = [
  // Single Qubit Gates
  { id: 'h', name: 'Hadamard', icon: HadamardGateIcon, color: 'text-green-400', description: 'Creates a superposition of |0> and |1> states.', type: 'single' },
  { id: 'x', name: 'Pauli-X', icon: PauliXGateIcon, color: 'text-red-400', description: 'Performs a bit-flip (NOT) on the qubit.', type: 'single' },
  { id: 'y', name: 'Pauli-Y', icon: PauliYGateIcon, color: 'text-red-400', description: 'Rotates the qubit by π around the Y-axis.', type: 'single' },
  { id: 'z', name: 'Pauli-Z', icon: PauliZGateIcon, color: 'text-red-400', description: 'Performs a phase-flip on the qubit.', type: 'single' },
  
  // Parametric Gates
  { id: 'rx', name: 'RX Gate', icon: RXGateIcon, color: 'text-pink-400', description: 'Rotates the qubit by angle θ around the X-axis.', type: 'single', params: ['theta'] },
  { id: 'ry', name: 'RY Gate', icon: RYGateIcon, color: 'text-pink-400', description: 'Rotates the qubit by angle θ around the Y-axis.', type: 'single', params: ['theta'] },
  { id: 'rz', name: 'RZ Gate', icon: RZGateIcon, color: 'text-pink-400', description: 'Rotates the qubit by angle θ around the Z-axis.', type: 'single', params: ['theta'] },

  { id: 's', name: 'S Gate', icon: SGateIcon, color: 'text-purple-400', description: 'Phase gate, rotates by π/2 around Z-axis.', type: 'single' },
  { id: 'sdg', name: 'S† Gate', icon: SDaggerGateIcon, color: 'text-purple-400', description: 'Conjugate transpose of the S gate.', type: 'single' },
  { id: 't', name: 'T Gate', icon: TGateIcon, color: 'text-purple-400', description: 'Phase gate, rotates by π/4 around Z-axis.', type: 'single' },
  { id: 'tdg', name: 'T† Gate', icon: TDaggerGateIcon, color: 'text-purple-400', description: 'Conjugate transpose of the T gate.', type: 'single' },
  
  // Controlled Gates
  { id: 'cnot', name: 'CNOT', icon: CNOTGateIcon, color: 'text-blue-400', description: 'Controlled-NOT. Flips target if control is |1>.', type: 'control' },
  { id: 'cz', name: 'Controlled-Z', icon: CNOTGateIcon, color: 'text-blue-400', description: 'Applies a Z gate to target if control is |1>.', type: 'control' },
  { id: 'swap', name: 'SWAP', icon: SwapTargetIcon, color: 'text-blue-400', description: 'Swaps the states of two qubits.', type: 'control' },
  
  // Measurement
  { id: 'measure', name: 'Measure', icon: MeasurementGateIcon, color: 'text-yellow-400', description: 'Measures the qubit state in the Z-basis.', type: 'single' },
];

export const gateMap: Map<string, QuantumGate> = new Map(
  gates.map(g => [g.id, g])
);