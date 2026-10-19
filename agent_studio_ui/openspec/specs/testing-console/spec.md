# Capability: Testing Console

## Purpose

The Testing Console lets users simulate an agent's execution without deploying it. Users can send a test input (text message or simulated voice transcript) and observe the agent's step-by-step response as if the graph were executing: which node activates, what tool calls are made, and what the final output is. All execution responses are simulated via mock data; no real LLM or backend calls are made.

---

## Requirements

### Requirement: Console Input

The system SHALL provide a chat-like input area where the user types or pastes a test message to send to the agent. If `enable_voice` is true on the agent, an additional "Simulate Voice Input" toggle SHALL allow the user to mark the message as a voice transcript.

#### Scenario: Sending a text message
- **WHEN** the user types a message in the console input and presses Enter or clicks "Send"
- **THEN** the message appears in the conversation thread as a user turn and the simulated agent response sequence begins

#### Scenario: Voice input toggle
- **WHEN** `enable_voice` is true and the user enables the voice input toggle
- **THEN** a microphone icon appears beside the input and the message is tagged as `[Voice]` in the thread display

---

### Requirement: Simulated Agent Execution Trace

The system SHALL display the simulated execution as a step-by-step trace, showing: which node is activated (with its name highlighted), the node's prompt (in a collapsed/expandable section), any tool calls made by that node (tool name + simulated input/output), and the node's output before moving to the next node.

#### Scenario: Executing a multi-node agent
- **WHEN** the user sends a test message to an agent with 3 connected nodes
- **THEN** the console shows each node activating in sequence with a brief animated indicator, then reveals the node's simulated output before the next node activates

#### Scenario: Tool call display
- **WHEN** a node's simulated execution calls a tool
- **THEN** the tool name, simulated arguments, and simulated return value are displayed in an expandable inline block within that node's trace entry

#### Scenario: Single node agent
- **WHEN** the user sends a message to an agent with only one node and no connections
- **THEN** only that node's trace is shown and the conversation ends with the node's output as the final response

---

### Requirement: Final Agent Response

The system SHALL display the final agent response (the output of the last node in the graph) as a clearly marked "Agent" message in the conversation thread, distinct from the trace entries.

#### Scenario: Final response display
- **WHEN** the simulated execution reaches the last node
- **THEN** the last node's output is displayed as an "Agent" bubble in the conversation thread below the trace

---

### Requirement: Conversation Thread

The system SHALL maintain a scrollable conversation thread that accumulates all user turns and agent responses within the current testing session. The thread persists until the user clicks "Clear console" or navigates away.

#### Scenario: Multiple turns in one session
- **WHEN** the user sends a second test message after the first exchange completes
- **THEN** both exchanges appear in the thread in chronological order; the view auto-scrolls to the latest message

#### Scenario: Clearing the console
- **WHEN** the user clicks "Clear console"
- **THEN** the thread is emptied and a fresh session begins

---

### Requirement: Node Selector for Partial Testing

The system SHALL allow the user to start the simulation from a specific node (rather than the first node in the graph) via a "Start from node" dropdown. This enables testing individual sub-paths without traversing the entire graph.

#### Scenario: Starting from a mid-graph node
- **WHEN** the user selects "Node B" from the "Start from node" dropdown and sends a message
- **THEN** the simulation begins at Node B, skipping Node A, and traces from Node B to the end of the graph

---

### Requirement: Mock Response Configuration

The system SHALL load all simulated execution responses, tool outputs, and node outputs from a dedicated mocks file. The user SHALL be able to toggle between pre-defined mock scenarios (e.g., "Happy path", "Tool error", "No tool calls") via a scenario picker in the console header.

#### Scenario: Switching mock scenario
- **WHEN** the user selects "Tool error" from the scenario picker
- **THEN** the next test run simulates a tool call failure in the appropriate node, showing the error in the trace

#### Scenario: Default scenario
- **WHEN** no scenario is selected
- **THEN** the "Happy path" scenario is used automatically
