:::figure{src="/media/example-photo-fedcba9876543210-800x600.webp" alt="A described photograph" credit="Photo: Someone"}
A caption with *emphasis*.
:::

:::figure{src="/media/example-chart-light-0123456789abcdef-640x360.svg" dark="/media/example-chart-dark-0123456789abcdef-640x360.svg" alt="A drawing with a twin for the dark theme"}
:::

![A loop of a plaque forming](/media/example-loop-0123456789abcdef-320x240.gif)

![A photograph from the library](/media/example-credited-0123456789abcdef-1200x800.jpg)

:::details{summary="Long methods"}
The details body, with a [link](https://example.com).
:::

:::sidenote{kind="Fallback"}
A note in the rail.
:::

A paragraph with a :pullquote[sentence worth raising] in it, and the color :swatch[#6b4fbb] and :swatch[the brand]{color=#fff}.

:::chart{type="bar" x="label" y="value" alt="Two bars, a at one and b at two" title="Counts"}
```csv
label,value
a,1
b,2
```
:::

:::chart{type="line" x="year" y="a,b" labels="Alpha,Beta" alt="Two lines rising" title="Series"}
```csv
year,a,b
2020,1,2
2021,2,3
2022,3,5
```
:::

:::diagram{title="Flow" alt="Box A points to box B"}
```mermaid
graph TD
  A --> B
```
:::
