
# Milimo Quantum Studio

![Milimo Quantum Studio Banner](https://i.imgur.com/your-banner-image.png) <!-- It's highly recommended to replace this with a screenshot or banner -->

**Milimo Quantum Studio is an intelligent, visually stunning, and beginner-friendly web-based Quantum Integrated Development Environment (IDE). It empowers users to design, simulate, and learn about quantum circuits through a state-of-the-art AI agentic workflow, powered by Google's Gemini API.**

---

## ✨ Key Features

*   **🤖 AI-Powered Circuit Design**: Describe complex quantum circuits or algorithms in natural language, and let the AI agents build them for you.
*   **🧠 Advanced Agentic Workflow**: A "Team of Experts" (Manager, Critic, Researcher, Designer) collaborates to understand your intent, prevent "lazy" solutions, and deliver high-quality, advanced circuits.
*   **🖐️ Interactive Canvas**: A drag-and-drop interface for placing gates, with full control over the number of qubits.
*   **⚡ Live Quantum Simulation**: Get instant feedback on your circuit's state vector and measurement probabilities as you build.
*   **🌐 Bloch Sphere Visualization**: Visually inspect the state of any individual qubit on an interactive 3D Bloch Sphere.
*   **🐍 Automatic Code Generation**: Instantly generate the equivalent Qiskit (Python) code for any circuit you design.
*   **📚 Rich Component Library**: Includes a comprehensive set of standard quantum gates, each with a clear description.

## 🛠️ Tech Stack

*   **Frontend**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Animation**: [Framer Motion](https://www.framer.com/motion/)
*   **AI**: [Google Gemini API](https://ai.google.dev/) (`@google/genai`)

## 🚀 Getting Started

Follow these instructions to set up and run Milimo Quantum Studio on your local machine.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18.x or later recommended)
*   A package manager like `npm` or `yarn`
*   A Google Gemini API Key

### Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/milimo-quantum-studio.git
    cd milimo-quantum-studio
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables**

    You need a Google Gemini API key to power the AI agents. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey).

    *   Create a file named `.env` in the root of the project.
    *   Add your API key to the `.env` file in the following format:

    ```
    API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```
    *This project uses a setup that automatically loads this variable into `process.env.API_KEY` for use in the frontend.*

4.  **Run the Development Server**

    This project is configured to run with a standard modern web development server like [Vite](https://vitejs.dev/).

    ```bash
    # If using Vite (recommended)
    npm run dev
    ```
    The application should now be running on `http://localhost:5173` (or another port if specified).

## 🧠 How It Works: The AI Agent Architecture

Milimo's intelligence comes from a collaborative team of specialized AI agents, ensuring robust and accurate results.

1.  **The Manager**: Receives the user's prompt and creates a high-level, multi-step plan. It determines which experts are needed for the task.
2.  **The Research Agent**: Gathers information, either by searching the web or by synthesizing its own internal knowledge, to find the best approach for a given problem.
3.  **The Critic**: Acts as a Quality Assurance layer. It reviews the research and the plan to ensure they align with the user's intent (e.g., preventing a simple Bell State when an "advanced" circuit was requested). It refines the plan for the next agent.
4.  **The Design Agent**: A master circuit builder that executes the vetted plan from the Critic. It uses its tools to modify the canvas, set the qubit count, and place gates with precision.
5.  **The Explanation Agent**: Synthesizes the entire journey—from the initial request to the Critic's reasoning and the final design—into a clear, user-facing narrative.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
