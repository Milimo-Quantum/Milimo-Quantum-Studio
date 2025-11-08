import React from 'react';
import type { QuantumGate, CustomGateDefinition } from '../types';
import GroupIcon from './icons/GroupIcon';

interface QuantumGateProps {
  gate: QuantumGate | CustomGateDefinition;
}

const QuantumGateComponent: React.FC<QuantumGateProps> = ({ gate }) => {
  const isCustom = 'gates' in gate;
  const Icon = isCustom ? GroupIcon : gate.icon;

  return (
    <div
      className="group relative flex items-center gap-3 p-2 rounded-md hover:bg-gray-700/50 transition-colors"
      title={!isCustom ? gate.description : `${gate.name} - Custom Gate`} // Simple tooltip
    >
      <div className={`w-8 h-8 rounded bg-gray-800 flex items-center justify-center border border-transparent group-hover:border-current ${gate.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm font-medium text-gray-300">{gate.name}</span>

       {/* Custom Tooltip on hover */}
      <div className="absolute left-full ml-4 w-48 p-2 bg-gray-900 border border-gray-700 rounded-md text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        {!isCustom ? gate.description : `${gate.name} - Custom Gate`}
      </div>
    </div>
  );
};

export default QuantumGateComponent;
