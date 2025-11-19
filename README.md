
# Milimo Quantum Studio

> **Stop Coding Quantum. Start Thinking It.**

For too long, the tools of quantum computing have demanded translation. You had an idea. A spark. A "what if." And then came the work. The work of translating your human thought into the rigid, unforgiving language of a machine. SDKs, boilerplate, linear algebra.

The tool wasn't your partner. It was a tollbooth. And the price of admission was your momentum.

This is the old way. It's over.

---

## The Conversation is the New Canvas

What if, instead of you learning the machine's language, the machine learned yours? What if you could simply *speak* an idea into existence?

This is **Milimo Quantum Studio**. It's not an IDE. It's an interlocutor.

You don't write code here. You have a conversation.

You say, *"Show me quantum teleportation."*
It doesn't just give you a circuit. It shows you the *thinking*. A team of AI agents—a researcher, a critic, a designer—collaborate in real-time, debating the best approach, discarding the simple answers, and building the elegant solution on your behalf. You see their work. You see the process.

## Features

### 🧠 Conversational Design
Build circuits by talking.
- **Milimo AI**: A multi-agent system (Manager, Research, Critic, Design) that translates natural language into quantum circuits.
- **Context Aware**: Ask to "Optimize this circuit", "Debug my Bell state", or "Run this on Google Sycamore".
- **Agentic Workflow**: Watch as specialized agents collaborate:
    - **Research Agent**: Scours knowledge to find the best algorithms.
    - **Critic Agent**: Reviews proposals for quality and constraints.
    - **Design Agent**: Implements the circuit logic.
    - **Debugger/Optimizer**: Fixes errors and simplifies gates.

### ⚛️ High-Fidelity Simulation & Visualization
- **Live Bloch Sphere**: Physics-based animations show the state vector's trajectory across the sphere surface.
- **Ghost Trails**: Visualize the path of rotation to understand the "how", not just the "where".
- **Noise Models**: Simulate real-world imperfections. Configurable **Depolarizing Error** and **Phase Damping** allow you to see how noise collapses the state vector and affects purity.
- **Physics Metrics**: Real-time display of state vector amplitudes ($\alpha|0\rangle + \beta|1\rangle$) and state purity.

### 🎓 Tutor Mode 2.0
A physics-aware Socratic companion.
- **Entanglement Detection**: Recognizes when qubits are entangled (Purity < 1.0) and prompts you to explore the implications.
- **Superposition Insights**: Explains probability amplitude shifts as you rotate vectors.
- **Hardware Suggestions**: Proactively suggests running circuits on specific hardware when you build standard states (like Bell or GHZ).

### 🔌 Multi-Backend Execution
- **Hardware Agnostic**: Seamlessly switch between **IBM Quantum** and **Google Quantum AI** providers.
- **Simulators**: Run shot-based simulations to test probabilistic outcomes without needing an API key.
- **Real Hardware Integration**: Generate and submit jobs to backends like `google_sycamore` or `ibm_brisbane` (simulated network latency and results in demo mode).

### 🛠️ Professional Workbench
- **Multi-SDK Export**: Generate clean, syntax-highlighted code for **Qiskit** (IBM) and **Cirq** (Google).
- **Parametric Gates**: Full support for rotation gates (`RX`, `RY`, `RZ`) with custom angles (radians or degrees).
- **Project Management**: Save, load, and organize named projects locally.
- **Smart Resizing**: Dynamically change qubit counts without destroying your existing work.

---

## Keyboard Shortcuts

**Navigation & Editing**
| Key | Action |
| :--- | :--- |
| `Arrow Keys` | Move Cursor (Navigation Mode) |
| `Enter` | Open **Quick Add** Gate Menu at Cursor |
| `Backspace` / `Delete` | Delete Selected Gate |
| `Drag Mouse` | Box Selection (Rubber banding) |

**Manipulation (When Item Selected)**
| Key | Action |
| :--- | :--- |
| `Arrow Left/Right` | Nudge Gate Position |
| `Arrow Up/Down` | Move Gate to adjacent Qubit |
| `Shift + Arrow` | Precise Nudge / Move Control Qubit |

**Project Control**
| Key | Action |
| :--- | :--- |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + S` | Save Project |
| `Ctrl/Cmd + L` | Load Project |

---

## The End of "Am I Ready?"

The greatest barrier to entry has never been the physics. It's been the fear. The feeling that you need to read one more textbook, take one more class, before you're "ready" to build.

Milimo says you're ready right now.

It says your curiosity is enough.
Your questions are the only prerequisite.
Your "what if" is the only SDK you need.

The work is no longer translation.
The work is to ask better questions.

**Go ask.**
