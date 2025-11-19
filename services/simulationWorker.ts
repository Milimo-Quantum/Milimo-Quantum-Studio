
import { simulate } from './quantumSimulator';

self.onmessage = (e: MessageEvent) => {
    const { placedItems, numQubits, customGateDefs, noise } = e.data;
    try {
        const result = simulate(placedItems, numQubits, customGateDefs, noise);
        self.postMessage({ type: 'result', result });
    } catch (error) {
        self.postMessage({ type: 'error', error: error instanceof Error ? error.message : 'Unknown simulation error' });
    }
};
