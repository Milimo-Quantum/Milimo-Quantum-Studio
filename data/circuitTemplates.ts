import type { AddGatePayload, CircuitTemplate } from '../types';

export const templates: CircuitTemplate[] = [
  {
    id: 'bell_state',
    name: 'Bell State',
    description: 'Creates a simple entangled state between two qubits.',
    gates: [
      { gateId: 'h', qubit: 0, left: 20 },
      { gateId: 'cnot', controlQubit: 0, qubit: 1, left: 50 },
    ],
  },
  {
    id: 'ghz_state',
    name: 'GHZ State',
    description: 'Creates a 3-qubit entangled state (Greenberger-Horne-Zeilinger).',
    gates: [
      { gateId: 'h', qubit: 0, left: 20 },
      { gateId: 'cnot', controlQubit: 0, qubit: 1, left: 50 },
      { gateId: 'cnot', controlQubit: 0, qubit: 2, left: 80 },
    ],
  },
];

export const templateMap = new Map(templates.map(t => [t.id, t]));
