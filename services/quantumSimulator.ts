import type { PlacedGate, SimulationResult, ComplexNumber, PlacedItem, CustomGateDefinition } from '../types';

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
  
  multiplyScalar(s: number): Complex {
    return new Complex(this.re * s, this.im * s);
  }

  magnitudeSq(): number {
    return this.re * this.re + this.im * this.im;
  }
  
  conjugate(): Complex {
    return new Complex(this.re, -this.im);
  }
}

// --- Matrix Helper Functions ---
type Matrix = Complex[][];

const multiplyMatrices = (A: Matrix, B: Matrix): Matrix => {
    const C: Matrix = Array(A.length).fill(0).map(() => Array(B[0].length).fill(new Complex(0)));
    for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < B[0].length; j++) {
            let sum = new Complex(0);
            for (let k = 0; k < A[0].length; k++) {
                sum = sum.add(A[i][k].multiply(B[k][j]));
            }
            C[i][j] = sum;
        }
    }
    return C;
}

const dagger = (M: Matrix): Matrix => {
    const T = Array(M[0].length).fill(0).map(() => Array(M.length).fill(new Complex(0)));
    for (let i = 0; i < M.length; i++) {
        for (let j = 0; j < M[0].length; j++) {
            T[j][i] = M[i][j].conjugate();
        }
    }
    return T;
}

const tensor = (A: Matrix, B: Matrix): Matrix => {
    const C: Matrix = [];
    for (let i = 0; i < A.length; i++) {
        for (let k = 0; k < B.length; k++) {
            const row: Complex[] = [];
            for (let j = 0; j < A[0].length; j++) {
                for (let l = 0; l < B[0].length; l++) {
                    row.push(A[i][j].multiply(B[k][l]));
                }
            }
            C.push(row);
        }
    }
    return C;
}

const partialTrace = (rho: Matrix, qubitToKeep: number, numQubits: number): Matrix => {
    const rhoReduced: Matrix = [[new Complex(0), new Complex(0)], [new Complex(0), new Complex(0)]];
    const numStates = 1 << numQubits;
    const qubitMask = 1 << (numQubits - 1 - qubitToKeep);

    for (let i = 0; i < numStates; i++) {
        const iBit = (i & qubitMask) ? 1 : 0;
        for (let j = 0; j < numStates; j++) {
            const jBit = (j & qubitMask) ? 1 : 0;
            // Check if the trace-out qubits are the same
            if ((i & ~qubitMask) === (j & ~qubitMask)) {
                rhoReduced[iBit][jBit] = rhoReduced[iBit][jBit].add(rho[i][j]);
            }
        }
    }
    return rhoReduced;
}

const trace = (M: Matrix): Complex => {
    let t = new Complex(0);
    for (let i = 0; i < M.length; i++) {
        t = t.add(M[i][i]);
    }
    return t;
}

// --- Quantum Gate Definitions (Matrices) ---
const I = [[new Complex(1), new Complex(0)], [new Complex(0), new Complex(1)]];
const X = [[new Complex(0), new Complex(1)], [new Complex(1), new Complex(0)]];
const Y = [[new Complex(0), new Complex(0, -1)], [new Complex(0, 1), new Complex(0)]];
const Z = [[new Complex(1), new Complex(0)], [new Complex(0), new Complex(-1)]];
const GATES: { [key: string]: Matrix } = {
  h: [[new Complex(1 / Math.sqrt(2)), new Complex(1 / Math.sqrt(2))],[new Complex(1 / Math.sqrt(2)), new Complex(-1 / Math.sqrt(2))]],
  x: X, y: Y, z: Z,
  s: [[new Complex(1), new Complex(0)], [new Complex(0), new Complex(0, 1)]],
  sdg: [[new Complex(1), new Complex(0)], [new Complex(0), new Complex(0, -1)]],
  t: [[new Complex(1), new Complex(0)], [new Complex(0), new Complex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))]],
  tdg: [[new Complex(1), new Complex(0)], [new Complex(0), new Complex(Math.cos(-Math.PI / 4), Math.sin(-Math.PI / 4))]],
};

const isValidQubit = (qubit: number | undefined, numQubits: number) => {
    return qubit !== undefined && qubit >= 0 && qubit < numQubits;
}

export const unrollCircuit = (
  placedItems: PlacedItem[],
  customGateDefs: CustomGateDefinition[]
): PlacedGate[] => {
  const unrolledGates: PlacedGate[] = [];
  for (const item of placedItems) {
    if ('gateId' in item) {
      unrolledGates.push(item);
    } else if ('customGateId' in item) {
      const def = customGateDefs.find(d => d.id === item.customGateId);
      if (def) {
        for (const relativeGate of def.gates) {
           unrolledGates.push({
             ...relativeGate,
             instanceId: `${item.instanceId}-${relativeGate.gateId}-${Math.random()}`,
             qubit: item.qubit + relativeGate.qubit,
             controlQubit: relativeGate.controlQubit !== undefined ? item.qubit + relativeGate.controlQubit : undefined,
             left: item.left
           });
        }
      }
    }
  }
  return unrolledGates;
};

const getOperatorForQubit = (op: Matrix, targetQubit: number, numQubits: number): Matrix => {
    let fullOp: Matrix = [[new Complex(1)]];
    for (let i = 0; i < numQubits; i++) {
        fullOp = tensor(fullOp, i === targetQubit ? op : I);
    }
    return fullOp;
}

const applyKrausOperators = (rho: Matrix, krausOps: Matrix[]): Matrix => {
    let newRho = rho.map(row => row.map(() => new Complex(0)));
    for (const K of krausOps) {
        const K_dagger = dagger(K);
        const rho_K_dagger = multiplyMatrices(rho, K_dagger);
        const K_rho_K_dagger = multiplyMatrices(K, rho_K_dagger);
        for(let i = 0; i < rho.length; i++) {
            for(let j = 0; j < rho.length; j++) {
                newRho[i][j] = newRho[i][j].add(K_rho_K_dagger[i][j]);
            }
        }
    }
    return newRho;
}


export const simulate = (
    placedItems: PlacedItem[], 
    numQubits: number, 
    customGateDefs: CustomGateDefinition[],
    noise: { depolarizing: number, phaseDamping: number }
): SimulationResult => {
  const numStates = 1 << numQubits;
  let rho: Matrix = Array.from({ length: numStates }, (_, i) =>
    Array.from({ length: numStates }, (_, j) => (i === 0 && j === 0 ? new Complex(1) : new Complex(0)))
  );

  const placedGates = unrollCircuit(placedItems, customGateDefs);
  const sortedGates = placedGates.sort((a, b) => a.left - b.left);

  for (const gate of sortedGates) {
    if (!isValidQubit(gate.qubit, numQubits) || (gate.controlQubit !== undefined && !isValidQubit(gate.controlQubit, numQubits))) {
        continue;
    }
    
    let U: Matrix = [[]]; // Full unitary for the gate
    
    // Construct the gate's unitary matrix U
    if (gate.gateId in GATES) {
        let op = [[new Complex(1)]];
        for (let i = 0; i < numQubits; i++) {
            op = tensor(op, i === gate.qubit ? GATES[gate.gateId] : I);
        }
        U = op;
    } else if (gate.gateId === 'cnot' && gate.controlQubit !== undefined) {
        U = Array.from({ length: numStates }, () => Array(numStates).fill(new Complex(0)));
        const controlMask = 1 << (numQubits - 1 - gate.controlQubit);
        const targetMask = 1 << (numQubits - 1 - gate.qubit);
        for (let i = 0; i < numStates; i++) {
            if ((i & controlMask) !== 0) U[i ^ targetMask][i] = new Complex(1);
            else U[i][i] = new Complex(1);
        }
    } else if (gate.gateId === 'cz' && gate.controlQubit !== undefined) {
        U = Array.from({ length: numStates }, () => Array(numStates).fill(new Complex(0)));
        const controlMask = 1 << (numQubits - 1 - gate.controlQubit);
        const targetMask = 1 << (numQubits - 1 - gate.qubit);
        for (let i = 0; i < numStates; i++) {
            if ((i & controlMask) !== 0 && (i & targetMask) !== 0) U[i][i] = new Complex(-1);
            else U[i][i] = new Complex(1);
        }
    } else if (gate.gateId === 'swap' && gate.controlQubit !== undefined) {
        U = Array.from({ length: numStates }, () => Array(numStates).fill(new Complex(0)));
         for (let i = 0; i < numStates; i++) {
            const bit1 = (i >> (numQubits - 1 - gate.qubit)) & 1;
            const bit2 = (i >> (numQubits - 1 - gate.controlQubit)) & 1;
            if (bit1 !== bit2) {
                const j = i ^ (1 << (numQubits - 1 - gate.qubit)) ^ (1 << (numQubits - 1 - gate.controlQubit));
                U[j][i] = new Complex(1);
            } else {
                U[i][i] = new Complex(1);
            }
        }
    } else if (gate.gateId === 'measure') {
        continue; // Measurement is probabilistic, handled by reading probabilities
    } else {
        continue;
    }

    // Apply gate: rho = U * rho * U_dagger
    const U_dagger = dagger(U);
    rho = multiplyMatrices(multiplyMatrices(U, rho), U_dagger);

    // Apply Noise Channels after each gate
    const allQubits = new Set([gate.qubit, gate.controlQubit].filter(q => q !== undefined));
    for(const q of allQubits) {
        // Depolarizing Channel
        if (noise.depolarizing > 0) {
            const p = noise.depolarizing;
            const K0 = getOperatorForQubit([[new Complex(Math.sqrt(1 - p)), new Complex(0)], [new Complex(0), new Complex(Math.sqrt(1 - p))]], q, numQubits);
            const K1 = getOperatorForQubit(X, q, numQubits).map(r => r.map(c => c.multiplyScalar(Math.sqrt(p/3))));
            const K2 = getOperatorForQubit(Y, q, numQubits).map(r => r.map(c => c.multiplyScalar(Math.sqrt(p/3))));
            const K3 = getOperatorForQubit(Z, q, numQubits).map(r => r.map(c => c.multiplyScalar(Math.sqrt(p/3))));
            rho = applyKrausOperators(rho, [K0, K1, K2, K3]);
        }
        // Phase Damping Channel
        if (noise.phaseDamping > 0) {
            const gamma = noise.phaseDamping;
            const K0 = getOperatorForQubit([[new Complex(1), new Complex(0)], [new Complex(0), new Complex(Math.sqrt(1 - gamma))]], q, numQubits);
            const K1 = getOperatorForQubit([[new Complex(0), new Complex(0)], [new Complex(0), new Complex(Math.sqrt(gamma))]], q, numQubits);
            rho = applyKrausOperators(rho, [K0, K1]);
        }
    }
  }

  const probabilities = Array.from({length: numStates}, (_, i) => {
    const binaryState = i.toString(2).padStart(numQubits, '0');
    return {
      state: `|${binaryState}⟩`,
      value: rho[i][i].re, // Diagonals of density matrix are probabilities
    };
  }).filter(p => p.value > 1e-9);
  
  const qubitStates = Array.from({length: numQubits}, (_, q) => {
      const rho_q = partialTrace(rho, q, numQubits);
      const x = trace(multiplyMatrices(rho_q, X)).re;
      const y = trace(multiplyMatrices(rho_q, Y)).re;
      const z = trace(multiplyMatrices(rho_q, Z)).re;
      const purity = trace(multiplyMatrices(rho_q, rho_q)).re;
      return { blochSphereCoords: { x, y, z }, purity };
  });

  return {
    probabilities,
    qubitStates,
    trace: trace(rho).re,
  };
};
