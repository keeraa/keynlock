// Planning estimate for potential residents; buildings may later contain
// workshops, commerce or public institutions rather than only apartments.
const RULES=Object.freeze({
  old:{residential:.88,areaPerResident:12},
  port:{residential:.68,areaPerResident:14},
  arts:{residential:.55,areaPerResident:19},
  bohemian:{residential:.78,areaPerResident:14},
  industrial:{residential:.48,areaPerResident:13},
  upper:{residential:.75,areaPerResident:27},
  palace:{residential:.44,areaPerResident:34},
});

export function estimateResidentCapacity(houses,district='old') {
  const {residential,areaPerResident}=RULES[district]??RULES.old;
  const estimate=Math.round(houses.reduce((sum,{config:c})=>
    sum+c.width*c.depth*c.floors*residential/areaPerResident,0));
  return {
    estimate,
    min:Math.max(0,Math.round(estimate*.8/5)*5),
    max:Math.round(estimate*1.2/5)*5,
  };
}
