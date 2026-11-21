import { useMemo } from 'react'
import type { BiginItem } from '../../api/_lib/bigin-transactions'
const money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})
const compact = new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1})
export default function BiginProductChart({items,loading,error,hasRange}:{items:BiginItem[];loading:boolean;error:string;hasRange:boolean}){
  const products=useMemo(()=>{
    const groups=new Map<string,{name:string;cents:number;quantity:number;hasRevenue:boolean;hasQuantity:boolean}>()
    for(const item of items){
      if(item.source!=='Linked product')continue
      const product=groups.get(item.name)||{name:item.name,cents:0,quantity:0,hasRevenue:false,hasQuantity:false}
      if(item.itemAmount!==null){product.cents+=Math.round(item.itemAmount*100);product.hasRevenue=true}
      if(item.quantity!==null){product.quantity+=item.quantity;product.hasQuantity=true}
      groups.set(item.name,product)
    }
    return [...groups.values()].sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name))
  },[items])
  const excluded=items.filter(item=>item.source!=='Linked product').length
  const maxRevenue=Math.max(1,...products.map(p=>Math.abs(p.cents/100)))
  const maxQuantity=Math.max(1,...products.map(p=>Math.abs(p.quantity)))
  return <section className="bigin-agent-card bigin-product-card" aria-labelledby="bigin-product-title">
    <div className="bigin-agent-heading"><div><span className="bigin-eyebrow">Product performance</span><h2 id="bigin-product-title">Revenue and quantity per item</h2><p>Paid deals from New Leads + Customer Service.</p></div><div className="bigin-product-legend"><span><i className="revenue"/>Item revenue (USD)</span><span><i className="quantity"/>Units sold</span></div></div>
    {loading?<p className="bigin-empty" role="status">Loading product revenue and quantities...</p>:error?<p className="bigin-empty">The item report must finish successfully before this chart can be shown.</p>:!hasRange?<p className="bigin-empty">Apply your paid date range to compare product performance.</p>:!products.length?<p className="bigin-empty">No linked product details are available for this date range.</p>:<>
      <div className="bigin-product-scale"><span>Revenue scale: $0 to {money.format(maxRevenue)}</span><span>Quantity scale: 0 to {compact.format(maxQuantity)}</span></div>
      <div className="bigin-product-scroll"><div className="bigin-product-bars" style={{minWidth:`${Math.max(620,products.length*135)}px`}} role="list" aria-label="Item revenue and units sold, highest revenue first">
        {products.map(product=><div className="bigin-product-group" key={product.name} role="listitem" aria-label={`${product.name}: ${product.hasRevenue?money.format(product.cents/100):'revenue unavailable'}, ${product.hasQuantity?product.quantity+' units':'quantity unavailable'}`}>
          <div className="bigin-product-pair">
            <div className="bigin-product-column"><span>{product.hasRevenue?money.format(product.cents/100):'N/A'}</span><div className={`bigin-product-bar revenue${product.cents<0?' negative':''}`} style={{height:`${Math.abs(product.cents/100)/maxRevenue*100}%`}} title={`${product.name}: ${money.format(product.cents/100)} item revenue`}/></div>
            <div className="bigin-product-column"><span>{product.hasQuantity?compact.format(product.quantity):'N/A'}</span><div className="bigin-product-bar quantity" style={{height:`${Math.abs(product.quantity)/maxQuantity*100}%`}} title={`${product.name}: ${product.quantity} units`}/></div>
          </div><strong>{product.name}</strong>
        </div>)}
      </div></div>
      <p className="bigin-agent-footnote">Revenue uses linked-product totals after discounts. Quantity sums product units. Each series uses its own scale.{excluded>0?` ${excluded} text-only product ${excluded===1?'row is':'rows are'} excluded because item amounts and quantities are unavailable.`:''}</p>
    </>}
  </section>
}
