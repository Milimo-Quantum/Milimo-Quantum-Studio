import type { PlacedGate, SimulationResult, ComplexNumber } from '../types';

// --- Complex Number Math ---
class Complex {
  constructor(public re: number = 0, public im: number = 0) {}

  add(c: Complex): Complex {
    return new Complex(this.re + c.re, this.im + c.im);
  }

  multiply(c: Complex): Complex {
    const re = this.re * c.re - this.im * c.im;
    const im = this.re * c.im + this.im * c.re;
    return new Complex(re, im);
  }

  magnitudeSq(): number {
    return this.re * this.re + this.im * this.im;
  }
}

// --- Quantum Gate Definitions (Matrices) ---
const GATES: { [key: string]: Complex[][] } = {
  h: [
    [new Complex(1 / Math.sqrt(2)), new Complex(1 / Math.sqrt(2))],
    [new Complex(1 / Math.sqrt(2)), new Complex(-1 / Math.sqrt(2))],
  ],
  x: [
    [new Complex(0), new Complex(1)],
    [new Complex(1), new Complex(0)],
  ],
  y: [
    [new Complex(0), new Complex(0, -1)],
    [new Complex(0, 1), new Complex(0)],
  ],
  z: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(-1)],
  ],
  s: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(0, 1)], // e^(i*pi/2) = i
  ],
  sdg: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(0, -1)], // e^(-i*pi/2) = -i
  ],
  t: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))], // e^(i*pi/4)
  ],
  tdg: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(Math.cos(-Math.PI / 4), Math.sin(-Math.PI / 4))], // e^(-i*pi/4)
  ],
};

const isValidQubit = (qubit: number | undefined, numQubits: number) => {
    return qubit !== undefined && qubit >= 0 && qubit < numQubits;
}

/**
 * Simulates a quantum circuit and returns the measurement probabilities.
 * @param placedGates The array of gates placed on the canvas.
 * @param numQubits The total number of qubits in the circuit.
 * @returns A SimulationResult object with probabilities and the final state vector.
 */
export const simulate = (placedGates: PlacedGate[], numQubits: number): SimulationResult => {
  const numStates = 1 << numQubits;
  let stateVector: Complex[] = Array.from({ length: numStates }, () => new Complex(0));
  stateVector[0] = new Complex(1); // Initialize to |00...0>

  const sortedGates = [...placedGates].sort((a, b) => a.left - b.left);

  for (const gate of sortedGates) {
    let newStateVector = [...stateVector];

    if (!isValidQubit(gate.qubit, numQubits) || (gate.controlQubit !== undefined && !isValidQubit(gate.controlQubit, numQubits))) {
        console.warn('Skipping invalid gate in simulation:', gate);
        continue;
    }

    switch (gate.gateId) {
      case 'h':
      case 'x':
      case 'y':
      case 'z':
      case 's':
      case 'sdg':
      case 't':
      case 'tdg':
        newStateVector = applySingleQubitGate(stateVector, gate.qubit, GATES[gate.gateId], numQubits);
        break;
      case 'cnot':
        if (gate.controlQubit !== undefined) {
          newStateVector = applyCNOT(stateVector, gate.controlQubit, gate.qubit, numQubits);
        }
        break;
      case 'cz':
        if (gate.controlQubit !== undefined) {
          newStateVector = applyCZ(stateVector, gate.controlQubit, gate.qubit, numQubits);
        }
        break;
      case 'swap':
        if (gate.controlQubit !== undefined) {
          newStateVector = applySWAP(stateVector, gate.qubit, gate.controlQubit, numQubits);
        }
        break;
      case 'measure':
        break;
    }
    stateVector = newStateVector;
  }

  const probabilities = stateVector.map((amplitude, i) => {
    const binaryState = i.toString(2).padStart(numQubits, '0');
    return {
      state: `|${binaryState}⟩`,
      value: amplitude.magnitudeSq(),
    };
  }).filter(p => p.value > 1e-9);

  return {
    probabilities,
    stateVector: stateVector.map(c => ({ re: c.re, im: c.im }))
  };
};

const applySingleQubitGate = (
  currentState: Complex[],
  qubit: number,
  matrix: Complex[][],
  numQubits: number
): Complex[] => {
  const numStates = 1 << numQubits;
  const newState = Array.from({ length: numStates }, () => new Complex(0));
  for (let i = 0; i < numStates; i++) {
    const bit = (i >> (numQubits - 1 - qubit)) & 1;
    const basisStateWithoutQubit = i & ~(1 << (numQubits - 1 - qubit));

    const i0 = basisStateWithoutQubit | (0 << (numQubits - 1 - qubit));
    const i1 = basisStateWithoutQubit | (1 << (numQubits - 1 - qubit));

    if (bit === 0) { // Applying to |...0...>
        newState[i] = currentState[i0].multiply(matrix[0][0]).add(currentState[i1].multiply(matrix[0][1]));
    } else { // Applying to |...1...>
        newState[i] = currentState[i0].multiply(matrix[1][0]).add(currentState[i1].multiply(matrix[1][1]));
    }
  }
  return newState;
};

const applyCNOT = (
  currentState: Complex[],
  controlQubit: number,
  targetQubit: number,
  numQubits: number
): Complex[] => {
  const newState = [...currentState];
  const controlMask = 1 << (numQubits - 1 - controlQubit);
  const targetMask = 1 << (numQubits - 1 - targetQubit);

  for (let i = 0; i < (1 << numQubits); i++) {
    if ((i & controlMask) !== 0) {
      const flippedState = i ^ targetMask;
      if (i < flippedState) {
        [newState[i], newState[flippedState]] = [currentState[flippedState], currentState[i]];
      }
    }
  }
  return newState;
};


const applyCZ = (
  currentState: Complex[],
  controlQubit: number,
  targetQubit: number,
  numQubits: number
): Complex[] => {
  const newState = [...currentState];
  const controlMask = 1 << (numQubits - 1 - controlQubit);
  const targetMask = 1 << (numQubits - 1 - targetQubit);
  for (let i = 0; i < (1 << numQubits); i++) {
    if ((i & controlMask) !== 0 && (i & targetMask) !== 0) {
      newState[i] = newState[i].multiply(new Complex(-1));
    }
  }
  return newState;
};

const applySWAP = (
  currentState: Complex[],
  qubit1: number,
  qubit2: number,
  numQubits: number
): Complex[] => {
  const newState = [...currentState];
  for (let i = 0; i < (1 << numQubits); i++) {
    const bit1 = (i >> (numQubits - 1 - qubit1)) & 1;
    const bit2 = (i >> (numQubits - 1 - qubit2)) & 1;
    if (bit1 !== bit2) {
      const j = i ^ (1 << (numQubits - 1 - qubit1)) ^ (1 << (numQubits - 1 - qubit2));
      if (i < j) {
        [newState[i], newState[j]] = [currentState[j], currentState[i]];
      }
    }
  }
  return newState;
};


/**
 * Calculates the expectation value of an operator for a given state. ⟨Ψ|O|Ψ⟩
 */
const calculateExpectationValue = (
  stateVector: Complex[],
  operatorMatrix: Complex[][],
  qubit: number,
  numQubits: number
): number => {
  const operatedState = applySingleQubitGate(stateVector, qubit, operatorMatrix, numQubits);
  let expectation = new Complex(0, 0);
  for (let i = 0; i < stateVector.length; i++) {
    const psi_i_star = new Complex(stateVector[i].re, -stateVector[i].im); // Conjugate
    expectation = expectation.add(psi_i_star.multiply(operatedState[i]));
  }
  // For Hermitian operators, the expectation value is real.
  return expectation.re;
};


/**
 * Calculates the Bloch sphere coordinates (x, y, z) for a single qubit.
 * These are the expectation values of the Pauli operators.
 */
export const getQubitBlochSphereCoordinates = (
  stateVectorComplex: ComplexNumber[],
  qubit: number,
  numQubits: number
): { x: number; y: number; z: number } => {
  if (stateVectorComplex.length === 0 || !isValidQubit(qubit, numQubits)) return { x: 0, y: 0, z: 1 };
  
  const stateVector = stateVectorComplex.map(c => new Complex(c.re, c.im));
  
  const x = calculateExpectationValue(stateVector, GATES.x, qubit, numQubits);
  const y = calculateExpectationValue(stateVector, GATES.y, qubit, numQubits);
  const z = calculateExpectationValue(stateVector, GATES.z, qubit, numQubits);

  return { x, y, z };
};