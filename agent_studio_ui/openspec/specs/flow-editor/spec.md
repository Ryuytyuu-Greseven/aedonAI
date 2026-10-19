# Capability: Flow Editor

## Purpose

The Flow Editor is the visual canvas where the user arranges agent nodes and draws directed edges between them to define execution order. It maps to the LangGraph directed graph: each edge from Node A to Node B sets A's `nextNode` to B's ID and B's `previousNode` to A's ID. The editor must support drag-and-drop positioning, connection drawing, and clear visual feedback for the graph topology.

---

## Requirements

### Requirement: Canvas and Node Rendering

The system SHALL render all agent nodes as interactive cards on a pannable, zoomable canvas. Each node card SHALL display: node name, prompt excerpt (first 60 chars or "No prompt"), and tool count badge. The canvas SHALL support panning via drag and zooming via scroll wheel or pinch.

#### Scenario: Rendering nodes on load
- **WHEN** an existing agent with multiple nodes is opened in the builder
- **THEN** all nodes are rendered on the canvas in their last saved positions; if no positions are saved, they are auto-arranged in a left-to-right flow

#### Scenario: Canvas panning
- **WHEN** the user drags the canvas background (not a node)
- **THEN** the viewport shifts, all nodes and edges move together

#### Scenario: Canvas zoom
- **WHEN** the user scrolls the mouse wheel over the canvas
- **THEN** the canvas zooms in or out around the cursor position; zoom is clamped between 30 % and 200 %

---

### Requirement: Node Drag and Reposition

The system SHALL allow the user to freely drag nodes to any position on the canvas. Node positions SHALL be stored as `x, y` coordinates and persisted with the agent on save. Edges SHALL reattach dynamically as the node is dragged.

#### Scenario: Dragging a node
- **WHEN** the user drags a node card to a new position
- **THEN** the node moves smoothly, connected edges follow the node's handles in real time, and on drop the new position is committed to in-memory state

---

### Requirement: Edge (Connection) Drawing

The system SHALL allow the user to draw a directed edge from one node to another by clicking and dragging from the node's output handle (right/bottom port) to another node's input handle (left/top port). Each node can have at most one outgoing edge (`nextNode`) and one incoming edge (`previousNode`).

#### Scenario: Drawing a connection
- **WHEN** the user drags from Node A's output handle and drops onto Node B's input handle
- **THEN** a directed edge is drawn between them, Node A's `nextNode` is set to Node B's ID, and Node B's `previousNode` is set to Node A's ID

#### Scenario: Attempting a second outgoing connection
- **WHEN** the user drags from Node A's output handle and Node A already has a `nextNode`
- **THEN** a tooltip shows "This node already has a next connection. Remove it first." and the drag is cancelled

#### Scenario: Connecting a node to itself
- **WHEN** the user drags from a node's output and drops it on the same node's input
- **THEN** the connection is rejected with a tooltip "A node cannot connect to itself"

---

### Requirement: Edge Deletion

The system SHALL allow the user to delete an edge by clicking on it and pressing Delete/Backspace or via a contextual "Remove connection" action. Deleting an edge clears `nextNode` on the source and `previousNode` on the target.

#### Scenario: Deleting an edge
- **WHEN** the user clicks an edge and presses Delete
- **THEN** the edge is removed from the canvas, the source node's `nextNode` is set to `null`, and the target node's `previousNode` is set to `null`

---

### Requirement: Mini-map

The system SHALL display a mini-map in the bottom-right corner of the canvas when there are 3 or more nodes. The mini-map shows a scaled-down view of all nodes and the current viewport rectangle. Clicking a region of the mini-map pans the canvas to that area.

#### Scenario: Mini-map visibility
- **WHEN** the agent has fewer than 3 nodes
- **THEN** the mini-map is hidden

#### Scenario: Mini-map navigation
- **WHEN** the user clicks on a region of the mini-map
- **THEN** the main canvas pans so that region is centered in the viewport

---

### Requirement: Auto-layout

The system SHALL provide a "Auto-layout" button that arranges all nodes in a clean left-to-right (or top-to-bottom) directed graph layout based on the current edge connections. The auto-layout SHALL run in-place without losing any node configuration.

#### Scenario: Running auto-layout
- **WHEN** the user clicks "Auto-layout"
- **THEN** nodes are repositioned to a DAG layout (e.g., layered/Sugiyama), edges redraw, and the canvas fits to the new layout
