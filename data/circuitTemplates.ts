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
  {
    id: 'quantum_teleportation',
    name: 'Quantum Teleportation',
    description: 'The core quantum circuit for the teleportation protocol (pre-measurement). Requires 3 qubits.',
    gates: [
       // Create Bell pair between q1 and q2
      { gateId: 'h', qubit: 1, left: 10 },
      { gateId: 'cnot', controlQubit: 1, qubit: 2, left: 30 },
       // Entangle q0 (the message) with q1
      { gateId: 'cnot', controlQubit: 0, qubit: 1, left: 50 },
      { gateId: 'h', qubit: 0, left: 70 },
       // In a real scenario, measurements on q0 and q1 would follow,
       // with classical communication to apply conditional X and Z gates to q2.
    ]
  }
];

export const templateMap = new Map(templates.map(t => [t.id, t]));