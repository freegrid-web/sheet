# Project tracker

A plan with three phases. Each phase's tasks are a [row group](../guide/row-groups): collapse a phase with its −
button, or click **1** in the corner to see only the phases.

- **Owner** and **Status** are dropdowns ([data validation](../guide/data-validation)); a blocked task turns red
  and a done one green ([conditional formatting](../guide/conditional-formatting)).
- **Progress** only takes 0 % to 100 %, and shows a data bar. Type `1.5` to see the message.
- **Issue** links to each task's issue: select the cell to see the link, Ctrl+click to open it.
- The ▾ in a header sorts and [filters](../guide/filters); Ctrl+F [finds](../guide/find-and-replace).
- Right-click ▸ **Show changes** lists what you changed ([change history](../guide/change-history)).

<LiveExample name="project-tracker" />

<<< @/examples/project-tracker.js
