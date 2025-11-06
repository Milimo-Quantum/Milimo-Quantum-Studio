import type { QuantumGate } from '../types';
import HadamardGateIcon from '../components/icons/HadamardGateIcon';
import CNOTGateIcon from '../components/icons/CNOTGateIcon';
import PauliXGateIcon from '../components/icons/PauliXGateIcon';
import MeasurementGateIcon from '../components/icons/MeasurementGateIcon';

export const gates: QuantumGate[] = [
  { id: 'h', name: 'Hadamard', icon: HadamardGateIcon, color: 'text-green-400', description: 'Creates a superposition of |0> and |1> states.', type: 'single' },
  { id: 'x', name: 'Pauli-X', icon: PauliXGateIcon, color: 'text-red-400', description: 'Performs a bit-flip on the qubit.', type: 'single' },
  { id: 'cnot', name: 'CNOT', icon: CNOTGateIcon, color: 'text-blue-400', description: 'Controlled-NOT. Flips target if control is |1>.', type: 'control' },
  { id: 'measure', name: 'Measure', icon: MeasurementGateIcon, color: 'text-yellow-400', description: 'Measures the qubit state in the Z-basis.', type: 'single' },
];

export const gateMap: Map<string, QuantumGate> = new Map(
  gates.map(g => [g.id, g])
);
