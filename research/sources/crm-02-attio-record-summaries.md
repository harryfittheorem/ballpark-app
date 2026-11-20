Source: https://attio.com/help/reference/managing-your-data/records/record-summaries
Title: Record summaries | Attio Help Center
Fetched: 2026-11-20T03:31:52.021Z

- [Help](https://attio.com/help)

/

- [Reference](https://attio.com/help/reference)

/

- [Managing your data](https://attio.com/help/reference/managing-your-data)

/

- [Records](https://attio.com/help/reference/managing-your-data/records)

/

- Record summaries


Table of Contents

Where record summaries appearUpdate a summaryUnderstand what a summary can includeEnable or disable record summaries for an objectRelated resourcesFAQ

Available on plus, pro, enterpriseand ultra plans.

**Admins** and members with **full access** to an object can enable record summaries for that object.

Record summaries don't use credits.

A record summary is a short, AI-generated overview of a record's current state, based on its attributes, emails, calls, notes, and tasks. It lets you catch up on a deal or account in a few seconds. Record summaries are enabled on Deals by default, and you can enable them on any other standard or custom object.

## Where record summaries appearCopy link

You'll see a record summary in three places:

- **Record pages:** At the top of the **Overview** tab, above highlights. The heading uses the object's name, such as **Deal summary**.

- **Record previews:** At the top of the **Overview** tab when you preview a record from a table or kanban view.

- **Hover cards:** In the card that appears when you hover over a record, such as its name in a table view or its card in a kanban view.


![](https://attio.com/_next/image?url=https%3A%2F%2Fa.storyblok.com%2Ff%2F234930%2F2434x712%2Fe6956e6992%2Fcleanshot_2026-11-10_at_13-27-512x.png&w=3840&q=75)

## Update a summaryCopy link

Attio generates a record summary on demand, for example when you open the record or hover over it. Each summary shows the timestamp for when it was generated. Once a summary is generated, every member who can see the record sees the same summary until someone updates it.

To update a summary after the record changes, click the **Update summary** icon next to the summary heading. Any member who can see the record can update its summary, including members with read-only access.

## Understand what a summary can includeCopy link

Record summaries only use information that everyone who can see the record can access, so a summary never reveals details a teammate couldn't see themselves.

Calls, notes, and tasks linked to the record are included. For emails, a summary uses what the whole workspace can see, based on the default sharing setting of the mailbox the email synced from:

- **Metadata only:** Participants and timestamps.

- **Subject line and metadata:** Participants, timestamps, and subject lines. This is the default.

- **Full access with workspace:** The email's content, in addition to its subject line and metadata.


Because **Subject line and metadata** is the default, most summaries use email subject lines but not email bodies. Full access granted to specific individuals doesn't affect summaries. Learn how to change sharing levels in [Share emails with your team](https://attio.com/help/reference/email-calendar/sharing-emails).

## Enable or disable record summaries for an objectCopy link

You turn record summaries on or off for each object separately.

1. Click your workspace name, then **Workspace settings**.

2. Open **Objects** in the sidebar.

3. Click the object.

4. Open the **Configuration** tab.

5. Under **Record summary**, enable or disable the **Enable record summary** toggle.


![](https://attio.com/_next/image?url=https%3A%2F%2Fa.storyblok.com%2Ff%2F234930%2F2222x2090%2Fe9e1da35db%2Fcleanshot_2026-11-10_at_13-01-142x.png&w=3840&q=75)

Summaries appear for all members as soon as you enable the toggle.

## Related resourcesCopy link

- Choose which highlights and tabs appear below the summary in [Configure record pages](https://attio.com/help/reference/managing-your-data/records/configure-record-pages).

- For a summary stored in an attribute that you can show in views and tailor with guidance, use the **Summarize record** type in [AI attributes](https://attio.com/help/reference/attio-ai/ai-attributes).


## Frequently asked questions

### Why don't I see a record summary?

Record summaries appear only when both of these are true:

- Your workspace is on a **Plus**, **Pro**, **Enterprise** or **Ultra** plan. On the **Free** plan, the record summary setting shows an upgrade prompt instead.

- Record summaries are enabled for the record's object. Ask an admin, or a member with full access to the object, to enable them.


### How are record summaries different from the Summarize record AI attribute?

Both produce a written summary of a record, but they work differently:

- **Record summaries:** Appear automatically at the top of record pages, use emails, calls, notes, and tasks as well as attributes, and don't use credits.

- **Summarize record AI attributes:** Store a summary in a text type attribute that you can show in views. They use attribute values only, accept **Guidance** on what to include, and use one workspace credit per record each time they're recalculated.


### Can I edit a record summary or change what it includes?

No, and you can't give it instructions. To change what it covers, update the record's data, such as its attributes or notes, then click **Update summary**.

### Why does a summary say there isn't enough information?

The record doesn't have enough data yet, for example no emails, calls, or notes. Once it has more data, click **Update summary**.

Expand all

Ask anything else