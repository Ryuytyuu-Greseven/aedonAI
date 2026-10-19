We are developing AedonAI, a voice agents builidng product. 
This project is for frontend, not backend. 
Lets use Angular as Frontend along with css. Use global variables, global classes, do no need to repeat the class, colors, variables and all.
Make the product switchable between Dark/Light Mode.


User Requirements
1) A simple Dashboard to List all the Active and Inactive agents.

Main Agent creation:
1) We can enable the Adding of agents.
2) We Shall enable the user to freely create multiple Nodes, where every node will be responsible for the langraph node of a graph.
3) Every node shall take a prompt message, which we use in the node to share to LLM, so we can give the behaviour of the Node.
4) Every node will have specific tools to be configured. So here, we will give a free tools creation. Where we can create multiple tools all in once. And also this particular tools creation is seperate then creating nodes.
5) We shall give a connecting in between the nodes. To enable which node have to be executed one after the other.
6) Have to create a complete JSON with the followinf paramers.
{
    agent_name: agent name given by user,
    enable_voice: boolean, if it's true; then this agent is a voice agent, lateron can be configured with calls.
    nodes: [
        {
            id: node_id,
            name: 'node name',
            tools:[list of tools ids],
            prompt: user provided prompt.
            nextNode: next connecting node
            previousNode: previous node if anything connecting.
        }
    ],
    tools: [all the tools that we created under this single agent]
}

7) Make the complete flow with a smooth UI. Add dummy API calls with static responses, so we can list data.
8) If any mock data is used, create a separate file as mocks and add those mock data in it. Do not add everything everywhere.
9) Also do not create unneccessary files, write the code properly  by following the design principles.
10) Create a version history tab, so we can load the history of the every node and complete agent. Including the prompt will have a history.
11) We shall a agent testing/simulation console so users can test the agent.
