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
  isSelected?: boolean;
}

// Agent-related Types
export type AgentName = 'Orchestrator' | 'Research' | 'Design' | 'Explanation';
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

// Simulation Types
export interface ComplexNumber {
  re: number;
  im: number;
}
export interface Probability {
  state: string;
  value: number;
}

export interface SimulationResult {
  probabilities: Probability[];
  stateVector: ComplexNumber[];
}

// Circuit Templates
export interface CircuitTemplate {
  id: string;
  name: string;
  description: string;
  gates: AddGatePayload[];
}