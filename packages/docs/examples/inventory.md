# Inventory

Office supplies with their stock, sorted with the lowest stock first. A traffic light shows each item's stock
against the others ([conditional formatting](../guide/conditional-formatting)), and an item that ran out is bold
and red.

- The SKU and item columns stay in view while the other columns scroll ([frozen panes](../guide/status-bar-and-freezing)).
- **Category** is a dropdown; **In stock** takes only whole numbers, 0 or more ([data validation](../guide/data-validation)).
- Prices are written the German way, with a comma and the euro sign ([number formats](../guide/cell-types#number-formats)).
- Select some prices: the [status bar](../guide/status-bar-and-freezing) sums them.
- The ▾ in a header [sorts and filters](../guide/filters); Ctrl+H [replaces](../guide/find-and-replace) a supplier's
  name everywhere at once.

<LiveExample name="inventory" />

<<< @/examples/inventory.js
