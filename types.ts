import React from 'react';

// Core Types
export interface QuantumGate {
  id: string;
  name: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  color: string;
  description: string;
  type?: 'single' | 'control';
}

export interface PlacedGate {
  instanceId: string;
  gateId: string;
  qubit: number; // Target qubit
  controlQubit?: number; // Control qubit for multi-qubit gates
  left: number; // Percentage position from left
  // FIX: Add isSelected property to allow destructuring in App.tsx and geminiService.ts
  isSelected?: boolean;
}

export interface CustomGateDefinition {
  id: string;
  name: string;
  color: string;
  // FIX: Omit isSelected from gates within a definition, as they don't have a selection state.
  gates: Omit<PlacedGate, 'instanceId' | 'isSelected'>[]; // Relative gate positions
}

export interface PlacedCustomGate {
    instanceId: string;
    customGateId: string;
    qubit: number; // Top-most qubit
    left: number;
    // FIX: Add isSelected property for consistency with PlacedGate.
    isSelected?: boolean;
}

// FIX: Simplify PlacedItem as its constituents now have the optional isSelected property.
export type PlacedItem = PlacedGate | PlacedCustomGate;


export interface CircuitState {
  placedItems: PlacedItem[];
  numQubits: number;
  customGateDefinitions: CustomGateDefinition[];
}


// Agent-related Types
export type AgentName = 'Manager' | 'Research' | 'Critic' | 'Design' | 'Explanation' | 'Debugger' | 'Optimizer';
export type AgentStatus = 'running' | 'completed';

export interface AgentStatusUpdate {
  agent: AgentName;
  status: AgentStatus;
  message: string;
}

// AI Communication Protocol
export type AddGatePayload = Omit<PlacedGate, 'instanceId' | 'isSelected'>;
export type ReplaceCircuitPayload = AddGatePayload[];

export type AIAction = 
  | { type: 'clear_circuit'; payload: null }
  | { type: 'add_gate'; payload: AddGatePayload }
  | { type: 'replace_circuit'; payload: ReplaceCircuitPayload }
  | { type: 'set_qubit_count'; payload: { count: number } }
  | { type: 'generate_code'; payload: null };

export interface Source {
  title: string;
  uri: string;
}

export interface AIResponse {
  displayText: string;
  actions: AIAction[];
  sources?: Source[];
}

// UI Message Types
export interface TextMessage {
  type: 'text';
  sender: 'user' | 'ai';
  text: string;
  sources?: Source[];
}

export interface AgentStatusMessage {
  type: 'agent_status';
  updates: AgentStatusUpdate[];
}

export type Message = TextMessage | AgentStatusMessage;
export type RightPanelTab = 'copilot' | 'visualization' | 'code' | 'hardware';

// Simulation Types
export interface ComplexNumber {
  re: number;
  im: number;
}
export interface Probability {
  state: string;
  value: number;
}

export interface QubitState {
    blochSphereCoords: { x: number, y: number, z: number };
    purity: number;
}

export interface SimulationResult {
  probabilities: Probability[];
  qubitStates: QubitState[];
  trace: number; // For debugging, should be ~1.0
}

// Hardware Job Types
export type JobStatus = 'idle' | 'submitted' | 'queued' | 'running' | 'completed' | 'error';
