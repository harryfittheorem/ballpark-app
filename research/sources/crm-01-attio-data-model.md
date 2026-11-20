Source: https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views
Title: Define your data model: attributes, views, lists and objects | Attio Help Center
Fetched: 2026-11-20T03:31:42.055Z

- [Help](https://attio.com/help)

/

- [Reference](https://attio.com/help/reference)

/

- [Attio 101](https://attio.com/help/reference/attio-101)

/

- [Attio's data model](https://attio.com/help/reference/attio-101/attios-data-model)

/

- Define your data model: attributes, views, lists and objects


Table of Contents

Understand the building blocksChoose an attribute, a view, a list, or an objectUse an attribute for a single current valueUse a view to segment existing recordsUse a list to run a processDecide between a view and a listCreate a custom object for a distinct entityConnect records with relationship attributesData model examples by industryData model mistakes to avoidRelated resourcesFAQ

Available on all plans.

Creating custom objects and custom relationship attributes requires a **Pro**, **Enterprise**, or **Ultra** plan.

Only **admins** can create custom objects. **Members** with full access to an object or list can create attributes.

Object limits depend on [your Attio plan](https://attio.com/pricing).

Attio's flexibility lets you model your CRM based on how your business runs, whether that involves deals and subscriptions, funds and LPs, client projects, or anything else. This guide walks through the building blocks and shows you how to map them onto the things your business tracks.

## Understand the building blocksCopy link

Before we get started, it’s important to understand the building blocks available in Attio to model how your business runs. We’ll use a spreadsheet as a reference point to explain some of these concepts.

- An **object** is a container for a particular type of data, like companies, people, or deals. It's the equivalent of a table in a spreadsheet. See [Understanding objects](https://attio.com/help/reference/attio-101/attios-data-model/understanding-objects) for what each standard object holds, and an overview of custom objects.

- A **record** represents one instance of an object, like a specific company, person, or deal you're tracking. It's the equivalent of a row in a spreadsheet. See [Understanding records](https://attio.com/help/reference/attio-101/attios-data-model/understanding-records).

- An **attribute** stores a particular piece of information about each record, like a person's email address. It's the equivalent of a column title in a spreadsheet, and the data stored in it for a given record is the attribute’s value. See [Understanding attributes](https://attio.com/help/reference/attio-101/attios-data-model/Understanding-attributes).

- A **relationship attribute** lets you show how records are connected. They’re useful for mapping real-world relationships, like which people work at a company. See [Relationship attributes](https://attio.com/help/reference/managing-your-data/attributes/relationship-attributes).

- A **list** is a subset of records of a given object that you’re running a process against. It lets you store data on each list entry (what we call a record in a list) that lives only in the list without editing the underlying record. See [Understanding lists](https://attio.com/help/reference/attio-101/attios-data-model/understanding-lists).

- A **list entry** is an instance of a record within a list, and it’s where list-specific attribute values are stored. See [Understanding lists](https://attio.com/help/reference/attio-101/attios-data-model/understanding-lists).

- A **view** controls how records or list entries are displayed, filtered, and sorted, without changing the underlying data. See [views](https://attio.com/help/reference/managing-your-data/views).


## Choose an attribute, a view, a list, or an objectCopy link

When you’re looking to store new data in Attio, you have four core options. Here’s some guidance on how to choose between them.

- **Attribute:** Use attributes when you want to store a new piece of data about an existing object, and that piece of data is generally relevant for every (or at least most) of that object’s records, for example, a customer's renewal date (SaaS), a fund's target size (VC), or a client's monthly retainer (agency).

- **View:** Use one when you need a different cut of records that already exist in an object, and the set should keep itself up to date, such as every company in a region or every deal closing this quarter.

- **List:** Use one to isolate a subset of records for a process, project, or segment, and you need data or permissions that apply only in that context, such as a customer onboarding queue (SaaS), the LPs in an active fundraise (VC), or a pitch list for new business (agency).

- **Object:** Use one when the thing you're tracking needs its own records, with their own attributes, relationships to other records, and a history you can report on, such as partners (SaaS), funds (VC), or client projects (agency).


When in doubt, choose the lighter structure. Start with an attribute or a view, move to a list when the process needs its own data or its own permissions, and create a custom object when the think you’re tracking needs it’s own relationships or reporting. Attributes, views, lists, and objects can all be added later, which means you don't need the perfect model before your team starts working.

## Use an attribute for a single current valueCopy link

An attribute stores data in the place your team is already looking, on an existing record. Ask whether one current value fully describes what you want to know. As an example, a company's main point of contact is a single fact about that company, so it belongs in an attribute. On the other hand, things like support escalations or renewals aren't single current values. Each one has its own date, owner, and context, so it shouldn't be stored as an attribute.

Both Objects and Lists have attributes: object attributes apply to all records of that object, whereas list attributes only apply to entries of that list. Learn more about the difference between them in [creating and managing attributes](https://attio.com/help/reference/managing-your-data/attributes/create-manage-attributes).

## Use a view to segment existing recordsCopy link

A view changes how records are displayed without changing the records and without creating anything new. You can create table or Kanban views, each with its own filters, sorts, and visible attributes. A single object can carry as many saved views as your team needs. On Deals, that might be a Kanban view by stage for working the pipeline, a table sorted by close date for forecasting, and a view for each rep to see their own pipeline. Because filters can reference the current user, a single shared view can show each person only their own deals.

A view is also the lightest way to give two teams different perspectives on the same data. Sales and customer success can each save their own view of the standard Companies object without duplicating a single record, and everyone stays on the same underlying records. Learn more about [creating and managing views](https://attio.com/help/reference/managing-your-data/views).

## Use a list to run a processCopy link

A list gives a team its own working space for records without changing the records themselves. You can add records to a list manually or populate the list with a [workflow automation](https://attio.com/help/reference/automations/workflows/getting-started-with-workflows).

For example, you could use a list of people to track invitees for an event. The list attributes would hold event-specific information like RSVP status and dietary requirements, which don't need to live permanently on the person record.

Use a list when:

- The records already exist in an object and you're organizing a chosen set of them for a purpose, like recruiting, onboarding, or a fundraise.

- You need attributes that only apply in that context, like the role a candidate applied for or a hiring manager's rating.

- You need to control who can see the data. [List access can be set to no access for some members](https://attio.com/help/reference/managing-your-data/lists/lists-access), while records in object views stay visible to everyone in the workspace.

- The process is temporary or the process is still taking shape.


A list shows the attributes that live on its underlying object, and you can edit them directly from the list. A list built on the standard People object, for example, can show and update each person's company.

Learn more about [lists and how to create them](https://attio.com/help/reference/managing-your-data/lists/create-lists).

## Decide between a view and a listCopy link

When deciding whether to use a view or a list to segment records, the question to ask is who decides what's in the group. The records that show in a view are determined by a set of filters. You save a filter, and records join and leave on their own as their attribute values change.

The records that show in a list are specifically chosen. A person or a [workflow](https://attio.com/help/reference/automations/workflows/getting-started-with-workflows) adds a record, and it stays until someone removes it.

If you can write the filter, use a view. If you can't, or the group needs its own attributes or its own permissions, use a list. These examples show the split in practice:

| What you want | Use | Why |
| --- | --- | --- |
| Every company in EMEA with more than 200 employees. | View | Membership is a rule. A company that grows past 200 employees should appear without anyone adding it. |
| The 12 accounts your team picked for a Q3 expansion push. | List | Someone chose them, and you may need to store information related to the effort that doesn’t live on the company record. No filter describes the set. |
| Every deal closing this quarter. | View | The set follows the close date. Deals join and leave as dates move. |
| The deals a manager hand-picked for a weekly pipeline review. | List | The risk rating and reviewer belong to the review, not to the deal record. |
| Companies with no interaction in the last 90 days. | View | The set follows interaction data and recalculates as records change. |
| Candidates interviewing for one role, with interview stage and scorecards. | List | Stage and scores apply only to this hiring process, and you may need to restrict who sees them. |

Lists also have their own views, which let you choose how to display the entries on that list.

## Create a custom object for a distinct entityCopy link

A custom object gives a concept its own records and its own attributes. Create one when the thing you're tracking passes this test: it's a real entity with its own attributes and its own relationships to other records.

A custom object also lets you guarantee data quality, which makes them especially useful when syncing data from another application or a data warehouse. [Custom required attributes](https://attio.com/help/reference/managing-your-data/attributes/create-manage-attributes#unique-and-required-attributes) can only be created on custom objects, so a custom Partners object can require a partner tier and an owner on every record from the moment it's created. You can also define a [unique attribute](https://attio.com/help/reference/managing-your-data/attributes/create-manage-attributes#unique-and-required-attributes) like an invoice number, which means no two records can share the same value for that attribute, useful for deduplication.

A Referral Partner is a good example, because each partner could be either a company or a person, so they can’t simply be a list of one of those objects. It’s common to track relationships between partners and multiple other objects: deals they’ve referred, key contacts, and the company they’re associated with.

Before creating one, check whether a [standard object](https://attio.com/help/reference/managing-your-data/objects/manage-standard-objects) already fits. Standard objects arrive with built-in attributes, [enrichment data](https://attio.com/help/reference/managing-your-data/enriched-data), and email features, so use one wherever it covers what you need.

When you're ready, see [how to create and manage custom objects](https://attio.com/help/reference/managing-your-data/objects/create-and-manage-custom-objects).

## Connect records with relationship attributesCopy link

A [relationship attribute](https://attio.com/help/reference/managing-your-data/attributes/relationship-attributes) links two records together and keeps both sides in step, so you only ever enter a connection once. When you link a company to a person record, that person appears on the company record automatically.

[The relationship type](https://attio.com/help/reference/managing-your-data/attributes/relationship-attributes#configure-the-relationship-type) sets how many records can be linked on each side, and the options are **One to one**, **One to many**, **Many to one**, and **Many to many**. The associated company attribute on a deal record is a good example: each deal can only be linked to one company, but a company can be linked to many deals. This lets you see and report on every deal for a particular company without a deal ever linking to two companies by mistake.

Name each side of the relationship for the role it plays. A SaaS team can connect the standard Companies object to a custom Partners object as **Referred by** on one side and **Referred companies** on the other. In the example below, one partner can refer many companies, but a company can only have one referring partner.

![](https://attio.com/_next/image?url=https%3A%2F%2Fa.storyblok.com%2Ff%2F234930%2F1620x836%2Fef3c78e22d%2Frelationship-attribute.png&w=3840&q=75)Once records are connected, you can [display, filter, and sort by attributes from the linked record](https://attio.com/help/reference/managing-your-data/attributes/relationship-attributes) in any view, such as showing each deal's company domain directly in your pipeline.

## Data model examples by industryCopy link

Whatever your business tracks, most data sits in the standard objects. What differs is which custom object you need:

- **SaaS:** Keep the companies you sell to, their people, and your pipeline in the standard Companies, People, and Deals objects. Keep your product accounts and the people who log into them in Users and Workspaces. Consider a custom Partners object because each partner has an owner, an agreement date, and a set of accounts it introduced. Use lists for events and recruiting.

- **VC and PE:** Keep portfolio companies and deal flow in the standard Companies and Deals objects, and create a custom Funds object, because each fund has its own vintage, target size, and set of LP commitments.

- **Agencies and professional services:** Keep clients in the standard Companies object, and create a custom Projects object, because one client runs several at once, each with its own budget, dates, and team.

- **Recruiting and staffing:** Keep candidates in the standard People object, and create a custom Roles object, because a role has its own brief, fee, and hiring manager, and it is the thing a candidate is matched to. Also, an Applications object could store details like the date and other application data long with links to the Role, People and Company involved via relationship attributes.

- **Nonprofits and grantmakers:** Keep donors in the standard Companies and People objects, and create a custom Grants object, because each grant carries its own amount, period, and reporting requirements rather than rolling up into a single total on the donor record.


Role-based relationships let the same person record act as a client stakeholder on one project and a specialist on another, without duplicating the record.

## Data model mistakes to avoidCopy link

- **Creating a custom object for a single value:** A customer tier only ever holds one value per company, so a Tier object would mean opening a second record to read one word. Keep it as a select attribute on the standard Companies object.

- **Using a text attribute where a select attribute belongs:** A text attribute accepts anything a person types, so an Industry attribute collects "Fintech", "FinTech", and "fin-tech" as three values that filter as three separate industries. A select or multi-select attribute gives your team a fixed set of options to pick from.

- **Encoding a relationship in a text attribute:** Typing a partner's name into a text attribute on a company looks like a link, but you can't click through to the partner record or report on every company that partner referred. Create the object and connect the two with a relationship attribute.

- **Creating a list where a view would do:** If a team needs the same records filtered differently, a saved view keeps the set complete and current. A list holds a fixed set that someone has to maintain.

- **Recreating the same data for different teams:** If sales and customer success both work with accounts, one standard Companies object with a list and a view for each team keeps everyone on the same records, where two near-duplicate objects drift apart.


## Related resourcesCopy link

- Get to know each standard object and what it holds in [Understanding objects](https://attio.com/help/reference/attio-101/attios-data-model/understanding-objects).

- When you're ready to build, [Create and manage custom objects](https://attio.com/help/reference/managing-your-data/objects/create-and-manage-custom-objects) walks through setup.

- Connect two objects with [relationship attributes](https://attio.com/help/reference/managing-your-data/attributes/relationship-attributes), and name each side for the role it plays.

- See every attribute type available in [Create and manage attributes](https://attio.com/help/reference/managing-your-data/attributes/create-manage-attributes).

- Set up your first process with [Create lists](https://attio.com/help/reference/managing-your-data/lists/create-lists).

- Save filters, sorts, and layouts for your team with [views](https://attio.com/help/reference/managing-your-data/views).


## Frequently asked questions

### Can Attio model a business that isn't a standard sales pipeline?

Yes, Attio is designed to support any data model. The standard Companies, People, Deals, Users, and Workspaces objects cover most GTM data, and custom objects plus relationship attributes handle everything else, from funds and LPs to grants, projects, and physical assets. If you can name your entities and describe how they relate, you can model them.

### Can I use a list attribute in more than one list?

No, list attributes can only be used in the list where they were created. If you find yourself needing the same attribute in multiple lists, one of these approaches usually applies:

1. **Create the attribute at the object level instead of the list level**


Object attributes are shared across all lists, so creating the attribute at the object level allows you to use it anywhere. You can [copy and paste values](https://attio.com/help/reference/managing-your-data/lists/bulk-updating-lists#bulk-update-attributes-with-copy-and-paste) from the list attribute to migrate them into the new object attribute. [Watch this video](https://www.loom.com/share/ee8d5899e35e49aeb691f7e197f8a25e) for a quick walkthrough of the process.

2\. **Use multiple views within one same list instead of separate lists**

If it doesn’t make sense to create the attribute on the object level, consider whether you could use multiple views on a single list rather than separate lists. This works well when you’re managing different segments of records that follow a similar process or track similar data. You can [filter the views](https://attio.com/help/reference/managing-your-data/views/filter-and-sort-views) by a list attribute.

For example:

- You have a “Recruiting” list, containing people (applicants).

- A “Role” select attribute tracks which role each person applied for.

- Rather than separate lists for each role, you could have these views:

  - **Account Executive** view, with a saved filter where Role > is > Account Executive

  - **Customer Success Manager** view, with a saved filter where Role > is > Customer Success Manager

### My spreadsheet uses tags. What should they become?

Turn each tag into an option on a select or multi-select attribute. Your team then picks from a dropdown instead of typing values, which gives you consistent spelling, colors for scanning, and clean filtering.

### Should I track my pipeline in the Deals object or a list?

A list is a simple alternative for tracking deal flow, but the standard Deals object is the more scalable setup. Deals act as a central hub for the notes, tasks, and attributes tied to each deal, while sales lists use company records, which can become cluttered when multiple teams work with the same companies.

### How can I migrate from a Sales list to the Deals object?

You can [export](https://attio.com/help/reference/imports-exports/exporting-lists-and-views) your active deals from your Sales list, then [import them](https://attio.com/help/reference/imports-exports/csv-imports/import-data-into-attio-via-csv) into the Deals object and begin tracking them there going forward. See [this video walkthrough](https://www.loom.com/share/4c85c1513d14445da8b875a358fa2324?sid=5b6e4e99-8d3c-4a45-9793-5b6869784084) of the process.

Keep your Sales list for historical reporting purposes, as there isn't a way to backdate stage changes. So when you want to report on your pipeline prior to migrating, you'll need to report on the list, then report on Deals for your pipeline going forward. For more help building your reporting dashboard, you can check out our video walkthrough for [building a sales reporting dashboard](https://www.loom.com/share/a37eaa0594244357a47c508a6d670a65?sid=706d38dd-1882-455b-bb37-b6051d51acde), and [this written guide](https://attio.com/help/reference/managing-your-data/dashboard-and-reports/build-a-sales-reporting-dashboard).

### Do I need to get the data model right from day one?

No. Attributes, views, lists, and objects can all be added later, and it's normal to start with a list and move to a custom object once relationships or reporting call for it.

Expand all

Ask anything else