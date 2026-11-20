Source: https://www.intercom.com/help/en/articles/6561699-assign-conversations-to-teammates-and-teams
Title: Assign conversations to teammates and teams | Intercom Help
Fetched: 2026-11-20T03:31:33.158Z

[Skip to main content](https://www.intercom.com/help/en/articles/6561699-assign-conversations-to-teammates-and-teams#docs-main)

If you want to make sure a conversation gets answered by the right person in your company, you should assign it to a particular teammate and team. There are three different ways to do that in Intercom:

**Note:** Manually assigning conversations is available to all teammates with Inbox access. Automatically assigning conversations requires Workflows, which are not available on all plans. Changing workspace assignment settings requires admin or workspace owner permissions.

- Manually assign conversations to a team and teammate.

- Automatically assign conversations to a team or teammate (you can evenly [assign conversations ‘round robin style’](https://www.intercom.com/help/en/articles/6512504-round-robin-deep-dive) to a specific team too).

- Assign all conversations to one team or teammate.


* * *

# How to manually assign a conversation

When you need to pass a conversation to someone else or another team you can quickly assign the conversation to the best teammate or team who can answer it.

Use the keyboard shortcut **` A`** to assign, or click the **Actions** icon (the four-square grid icon) below the message composer and select **Assign to.**

![Screenshot of the Intercom Inbox showing the command palette with 'assign' typed, displaying the Assign to option with keyboard shortcut A highlighted in the dropdown](https://downloads.intercomcdn.com/i/o/849093593/f3c7846644ea37c2b0cf2bba/image.png?expires=1795052700&signature=9ca7e0f75a69d67556143bfdf7ab362a2459897231482cbab8faa2b1b8e9a1ed&req=fCQuFsB9mIhcFb4f3HP0gKSMriXwYnXxUO%2F0sWxmHzm7GUQf5DspN7rcxofm%0An40Q8Nai0fpNCEU05w%3D%3D%0A)

Manually assigning a conversation to a teammate will not interrupt any active [Workflows](https://www.intercom.com/help/en/articles/7836459-workflows-explained) or [Fin](https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained). Automations are only interrupted when a teammate sends a message in the conversation.

## How to bulk assign conversations

To bulk assign/close conversations, first select the checkboxes next to the conversations you want, and then click the **Assign** or **Close** button that appears.

![Screenshot of the Intercom Inbox showing 20 of 355 conversations selected with checkboxes, with the Assign selection button and bulk action icons appearing at the top of the conversation list](https://downloads.intercomcdn.com/i/o/tx2p130c/1248791089/992e10fcc2aeb2d45965f047f879/Screenshot+2024-11-12+at+13_28_46.png?expires=1795052700&signature=bd00681961137525062e11f27f7aa5790450514db614159c1cf37376408a57d5&req=dSIjHs53nIFXUPMW1HO4zWGdXeWSb5wi%2FyCBeCYAHUoE09Kra7qm0MxpkAi%2F%0Ahpnyq4cS7qjC%2FBLSd%2Bo%3D%0A)

You can also select the pencil icon to bulk edit your conversations which will allow you to perform the following actions:

- Send a Reply/Note (and insert a macro — a saved response template)

- Assign to team

- Assign to teammate

- Add tag

- Snooze

- Close

- Change priority

- Data connector (using API)

- Add topic

- Re-open

- Set ticket state


![Screenshot of the Intercom Inbox bulk edit modal titled Update 2 items, showing the Add actions dropdown expanded with options including Assign to team, Assign to teammate, Add tag, Snooze, Close, Change priority, Data connector (using API), Add topic, Re-open, and Set ticket state](https://downloads.intercomcdn.com/i/o/tx2p130c/2641406232/f5fc0296ace6907aa8cfc1a4c3f7/CleanShot+2026-08-31+at+09_37_31%402x.png?expires=1795052700&signature=7ee933fd5e8eecd245a0cede4bd64b9edfd8efc31bc3753963f562ba1c0c53eb&req=diYjF81%2Bm4NcW%2FMW1HO4zR7LSUj6mPDvNnqYckMr8xr9Nd2akZkpV2%2BJc8%2Ft%0A7F7i9JPKyv0zNbrDtek%3D%0A)

Large bulk jobs run in the background — you'll see a "started" notification immediately and a "completed" notification when the job finishes. The results list refreshes automatically so acted-on conversations drop off. Conversations that can't take the action (for example, already-closed conversations when bulk-closing) are skipped silently and won't appear in the completed results.

Intercom's REST API (a developer tool for programmatic access to Intercom data) allows you to perform a number of bulk updates to conversations, including [closing](https://developers.intercom.com/docs/references/rest-api/api.intercom.io/Conversations/manageConversation/), [snoozing](https://developers.intercom.com/docs/references/rest-api/api.intercom.io/Conversations/manageConversation/), [replying](https://developers.intercom.com/docs/references/rest-api/api.intercom.io/Conversations/replyConversation/), and [assigning](https://developers.intercom.com/docs/references/rest-api/api.intercom.io/Conversations/autoAssignConversation/) conversations.

To perform any of these actions you will need a list of the conversation IDs for your chosen criterium. Directions for how to search for conversations using our API are located [here](https://developers.intercom.com/docs/references/rest-api/api.intercom.io/Conversations/searchConversations/).

## How assigning to a teammate works

When you manually assign a conversation to a specific teammate, the team assignment also remains in place. This means if that teammate switches on [away mode](https://www.intercom.com/help/en/articles/6522874-manage-teammate-status), the conversation will be automatically assigned back to the correct team.

## How assigning to a team works

Assigning a conversation to a team will remove the teammate assignment, so it can be picked up from that team’s inbox at the right time, or assigned automatically by round robin, or [workload management](https://www.intercom.com/help/en/articles/6560715-automatically-route-conversations-to-teammates).

**Note**: When a conversation is closed by a teammate or automation, the assigned teammate and team remain unchanged. No reassignment or routing occurs as part of the closure process.

## What happens when you manually assign a closed conversation to a team?

When a teammate manually assigns a closed conversation to a team in the Inbox, the conversation is always reopened. This applies regardless of any workflows or conversation attributes in your workspace.

To assign a closed conversation to a team without reopening it, use a workflow that is triggered by the conversation closing. When a workflow triggered by a conversation closing assigns the conversation, the conversation stays closed. Manual assignments don't keep the conversation closed.

* * *

# How to automatically assign conversations

Conversations can be assigned automatically using Workflows. To create a Workflow go to [Fin AI Agent > Workflows](https://app.intercom.com/a/apps/_/automation/workflows-overview) and click **+New workflow.**

![Screenshot of the Fin AI Agent Workflows page in Intercom showing 190 workflows grouped by trigger type, with the +New workflow button in the top right corner](https://downloads.intercomcdn.com/i/o/tx2p130c/1873336866/903500b9586371d3894a1848cfb5/CleanShot+2025-12-09+at+12_19_19%402x.png?expires=1795052700&signature=3d7f25642f9e2caf871502e31b5d5a4844ef9fba0604be5603acb0dac4a47313&req=dSggFcp9m4lZX%2FMW1HO4zaStyDipyu3f4wiZWNC4XvoXkd%2FEaJqQYtlE4z8L%0AHro33hFaEhfO1mhBXV8%3D%0A)

Workflows can also automatically tag conversations, mark them as priority, or set conversation attributes & SLA rules. Learn more about [building Workflows](https://www.intercom.com/help/en/articles/6611595-using-the-workflows-builder) for all your automations.

The best triggers to use for this kind of Workflow are:

- Customer opens a new conversation in the Messenger.

- Customer sends their first message.

- Customer sends any message

- A ticket is created


![Screenshot of the Intercom Workflows builder showing a workflow triggered when a customer opens a new conversation in the Messenger, with the Apply rules step being searched for and selected from the Add step menu](https://downloads.intercomcdn.com/i/o/tx2p130c/2641342011/21495ac7ebc8ed6bd6a7555f2bb2/CleanShot+2026-08-31+at+08_50_39%402x.png?expires=1795052700&signature=306708530f2fe96c60ad00519fc93a1d1ffb49dc7a62715185717af51d8174d5&req=diYjF8p6n4FeWPMW1HO4zSEXLpBLt8GGvcboavsC5o3TzMrhGTlEYoHSFecC%0AoIBdOgZ02Rc%2BT6TFvCg%3D%0A)

Once your trigger is set, add an **Apply rules** step to assign conversations to a team or teammate based on the content of the messages, conversation attributes, how long a customer has been waiting and/or any information about the lead, user or company that you track in Intercom. For example, you can route conversations by plan type, message content, language, or any custom attribute you track in Intercom.

The screenshots below show a rule that assigns conversations to the Customer Success team when the customer's plan is Lite.

![Screenshot of the Workflows builder showing the Apply rules step with conditions based on conversation attributes such as Plan and Message Content](https://downloads.intercomcdn.com/i/o/tx2p130c/2641343014/47f1098ab5777a51c02505d52015/CleanShot+2026-08-31+at+08_51_24%402x.png?expires=1795052700&signature=2b3f3adf3d940a63b276df39004b6b1ee3daaf94eb67c6812379567640ec427c&req=diYjF8p6noFeXfMW1HO4zZWke4bvPeXz4xZzqIj9O2cZEhK7uNOyjle3dpAz%0AToUP%2FLyXeTynzo2ceW4%3D%0A)

For example, if **Plan** is 'Lite' and **Message Content** contains 'upgrade', then **Assign to** 'Customer Success'.

![Screenshot of the Intercom Workflows builder showing the Apply rules panel with a rule configured: if plan is lite, then Assign to Customer Success](https://downloads.intercomcdn.com/i/o/tx2p130c/2641343677/6a6c5a96ccf62b839bcbc76b437a/CleanShot+2026-08-31+at+08_52_17%402x.png?expires=1795052700&signature=5b0845dc748b5176544b9ea41a464a546aeefe5092af722a02b2910f74a75351&req=diYjF8p6nodYXvMW1HO4zQwbrPUFB%2BJ6rCuk5yr4dLy2fuCk2ebEOWbue%2BeI%0AIyYEJxEBi6OhCUcg4X0%3D%0A)

You can then click **Save and close** and set your Workflow live. Once live, Intercom will automatically assign any new conversations that match your rules to the specified teammate or team.

# Best practices for workflow optimization

Keep the following in mind when building and maintaining Workflows for conversation assignment:

- **Test New Workflows**: Start a new conversation or ticket to verify that workflows trigger and execute as expected.

- **Review Workflow Priority**: Ensure workflows are ordered correctly to avoid conflicts.

- **Monitor Fin Deployment**: Regularly review Fin-enabled workflows to confirm they are live and configured correctly.


**Notes:** The following limitations apply when using Workflows for conversation assignment:

- Currently, there is no way to add new participants to a conversation via [Workflows](https://www.intercom.com/help/en/articles/7836459-workflows-explained). This must be managed manually within the [conversation header](https://www.intercom.com/help/en/articles/6435588-manage-group-conversations-via-the-help-desk#h_a04e285399) or within the [conversation composer](https://www.intercom.com/help/en/articles/6435588-manage-group-conversations-via-the-help-desk#h_f51f8ef618).

- When a conversation is assigned to a team inbox via a macro (a saved response template), and round robin is enabled for that inbox, round robin assignment will occur and the conversation will be assigned to an active teammate. This applies to both new and existing conversations moved by macro actions.

- Background workflows may defer email assignment when Fin Inbox (Intercom's AI-handled inbox) is enabled. Use customer-facing workflows to avoid this issue.

- If your Workflow uses the 'Customer sends their first message' trigger, it may not fire for visitors if it evaluates before identity is captured. To avoid this, use the 'Customer sends any message' trigger instead, which evaluates after identity capture.


**Workflows** are not available on all [Intercom Plans](https://www.intercom.com/help/en/articles/9061614-intercom-plans-explained). You can learn more about Intercom's pricing plans and which features are available [here](https://www.intercom.com/help/en/articles/9061614-intercom-plans-explained)!

* * *

# How to change the default assignee

If a conversation doesn’t match any of your Workflow rules, it will be assigned to your default assignee (inbox recipient), which you can select from [Settings > Inbox > Assignments > General](https://app.intercom.com/a/apps/_/settings/helpdesk/assignments) in the "Default assignee"section. This workspace-level setting also determines where inactive (idle) conversations are routed, including those that leave the bot inbox after 15 minutes of inactivity, and can't be customized per individual workflow.

**Note:** Changing the default assignee requires the "Can access Proactive Support settings" permission. Teammates without this permission will not be able to modify this setting. If a teammate is unable to change the default assignee, often "Unassigned" by default, contact your workspace admin to enable this permission.

![Screenshot of Settings &gt; Inbox &gt; Assignments &gt; General in Intercom showing the Default assignee section with the Unassigned dropdown and options for self-assign, teammate presence, and assigning conversations to Fin AI Agent](https://downloads.intercomcdn.com/i/o/tx2p130c/2641344887/f0ada865f08f6df4e7f6c150dfe6/CleanShot+2026-08-31+at+08_53_19%402x.png?expires=1795052700&signature=ec57cb2816bce1c2a1bb26596da3539801502454a8a19d1a9eefde51e024603e&req=diYjF8p6mYlXXvMW1HO4zYTMmaUWz9TSopgW%2FhwUmTlGafSH44kdH%2FWRot2U%0AmEZfVDPfbGx4sigYd3k%3D%0A)

**Note:** If a conversation is started from an article in the Help Center, the default assignment will not work for these conversations. You will need to create a Workflow to route these conversations.

For Workflows, the default assignments are applied immediately without waiting for the execution of background Workflows to finish.

**Note:** When a conversation starts, the Workflow's assignment and the default team assignment run as two independent processes at the same time. Previously, whichever process finished last determined the final assignee, which could cause the default assignment to silently overwrite a correct Workflow assignment — even when the Workflow ran first. This has been fixed: the Workflow's assignment decision is now applied first, and the default assignment only triggers if no Workflow criteria were matched.

**Important**: The default assignee setting applies **only to conversations**. It does not automatically assign newly created tickets. To automatically assign tickets to a specific team or teammate, you must use a Workflow.

* * *

# How to control who can reassign conversations

You can control who can reassign conversations that are already assigned to teammates. This ensures your sales and support teams don't lose conversations that they're working on in their own inbox.

Just go to [Teammate settings](https://app.intercom.com/a/apps/_/settings/workspace/teammates), click **Edit** on a teammate, and uncheck **Can reassign conversations and edit lead or user ownership**, then click **Save changes**. The permission takes effect immediately.

![Screenshot of the Intercom teammate permission settings showing the Inbox section with the Can reassign conversations and edit lead or user ownership checkbox currently enabled (checked)](https://downloads.intercomcdn.com/i/o/tx2p130c/2641346218/9a8e4eb7d9dff043bdef1a45bb3d/CleanShot+2026-08-31+at+08_54_46%402x.png?expires=1795052700&signature=47981ffc01db91dc0b67290457221b0565b325490393059062f7986025ceedb0&req=diYjF8p6m4NeUfMW1HO4zWAZlJuArWDqven8AzPaXxabeLPsgRWRTJiNcGDs%0AnIv3fO7b2MJ6WK815q0%3D%0A)

The **Can reassign conversations and edit lead or user ownership** permission only prevents reassigning conversations from a teammate's inbox. Teammates will still be able to assign conversations from team inboxes and the **Unassigned** inbox.

## How to see who a conversation is assigned to?

You can view which teammate and team inbox a conversation is assigned to under the **Details** section which is permanently placed at the top right when using the Intercom Inbox.

![Screenshot of an Intercom conversation with the Details panel open on the right, showing the Assignee as Beth-Ann Sher and Team as Cross-Functional Support highlighted in the panel](https://downloads.intercomcdn.com/i/o/849101631/2d53ef9cbba13e94325eb146/image.png?expires=1795052700&signature=969a76cbde775d63b214b3759f28504b9cff50d10660ad00ef17d6d1812bc702&req=fCQuF8l%2Fm4JeFb4f3HP0gGHu5h%2F7mT6w841%2BdCqGbL25EiTCNfQPQpPcVlKM%0ArCt3%2BSl3scTkJkpVWg%3D%3D%0A)

If viewing your inbox using the Table View, there is an Assignee and Team column that shows the team/teammate the conversation is currently assigned to (if the column doesn't appear, you'll need to add it using the **\+ icon.**

![Screenshot of the Intercom Inbox in Table View showing conversations with an Assignee column highlighted, displaying a mix of assigned teammates and unassigned conversations, with an arrow pointing to the + button to add more columns](https://downloads.intercomcdn.com/i/o/849104158/e9ead7971c36b477ec00a0e1/image.png?expires=1795052700&signature=ec1ca738d561dc6bb93bed1b3ddd98428687d4073663639a61fa76b2aa852b21&req=fCQuF8l6nIRXFb4f3HP0gEVs0kNi4DPyo9CS%2FKfECSumLjnl7CUYezC44MRf%0AAE61kbeOwLPMBMlAfQ%3D%3D%0A)

You can click and drag the columns to re-order them and click the 3 dots on a column to hide it so you can focus on the most important information.

* * *

💡 **Tip**

**Need more help?** Get support from our [Community Forum](https://community.intercom.com/?utm_source=ii-help-center&utm_medium=internal)

Find answers and get help from Intercom Support and Community Experts

* * *

Did this answer your question?

Disappointed ReactionNeutral ReactionSmiley Reaction

## Related Articles

- [Turn on the bot inbox](https://www.intercom.com/help/en/articles/3722087-turn-on-the-bot-inbox)
- [Workload management explained](https://www.intercom.com/help/en/articles/6560715-workload-management-explained)
- [How to auto reassign conversations from unresponsive teammates](https://www.intercom.com/help/en/articles/11793789-how-to-auto-reassign-conversations-from-unresponsive-teammates)
- [Route conversations to a team inbox](https://www.intercom.com/help/en/articles/11868425-route-conversations-to-a-team-inbox)
- [Manage and troubleshoot assignment Workflows](https://www.intercom.com/help/en/articles/11961281-manage-and-troubleshoot-assignment-workflows)