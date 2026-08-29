  class ToolMotionController{
    constructor(root=document.documentElement,options={}){
      this.root=root;
      this.response=Math.max(120,Number(options.response)||620);
      this.parallaxResponse=Math.max(120,Number(options.parallaxResponse)||360);
      this.row=0;
      this.depth=0;
      this.parallaxX=0;
      this.parallaxY=0;
      this.targetRow=0;
      this.targetDepth=0;
      this.pointerTargetX=0;
      this.pointerTargetY=0;
      this.touch=false;
      this.kick=0;
      this.frame=0;
      this.lastFrame=performance.now();
    }

    targetFromLinear(values,index,{min=0,max=1}={}){
      const items=Array.isArray(values)?values:[];
      const safeIndex=Math.max(0,Math.min(items.length-1,Number.isFinite(index)?index:0));
      const span=Math.max(.001,max-min);
      return {
        row:items.length>1?safeIndex/(items.length-1)-.5:0,
        depth:items.length?Math.max(-.5,Math.min(.5,(Number(items[safeIndex])-min)/span-.5)):0
      };
    }

    setTarget({row=0,depth=0}={}){
      this.targetRow=Math.max(-.5,Math.min(.5,Number(row)||0));
      this.targetDepth=Math.max(-.5,Math.min(.5,Number(depth)||0));
      this.schedule();
    }

    setPointer(pointerX=0,pointerY=0,{touch=false}={}){
      this.pointerTargetX=Number(pointerX)||0;
      this.pointerTargetY=Number(pointerY)||0;
      this.touch=!!touch;
      this.schedule();
    }

    impulse(amount=1){
      this.kick=Math.min(1,this.kick+Math.max(0,Number(amount)||0));
      this.schedule();
    }

    schedule(){
      if(this.frame)return;
      this.frame=requestAnimationFrame(now=>this.animate(now));
    }

    animate(now){
      this.frame=0;
      const dt=Math.min(50,Math.max(0,now-this.lastFrame));
      this.lastFrame=now;
      this.update(dt,{pointerX:this.pointerTargetX,pointerY:this.pointerTargetY,now,touch:this.touch});
      const moving=Math.abs(this.row-this.targetRow)>.002||Math.abs(this.depth-this.targetDepth)>.002
        ||Math.abs(this.parallaxX-(this.touch?0:this.pointerTargetX))>.03
        ||Math.abs(this.parallaxY-(this.touch?0:this.pointerTargetY))>.03||this.kick>.003;
      if(moving)this.schedule();
    }

    update(dt,{pointerX=0,pointerY=0,now=performance.now(),touch=false}={}){
      const follow=1-Math.exp(-Math.max(0,dt)/this.response);
      const parallaxFollow=1-Math.exp(-Math.max(0,dt)/this.parallaxResponse);
      this.row+=(this.targetRow-this.row)*follow;
      this.depth+=(this.targetDepth-this.depth)*follow;
      this.parallaxX+=((touch?0:pointerX)-this.parallaxX)*parallaxFollow;
      this.parallaxY+=((touch?0:pointerY)-this.parallaxY)*parallaxFollow;
      this.kick*=Math.exp(-Math.max(0,dt)/680);
      const pulse=this.kick*(touch ? .32 : 1);
      const pulseSin=Math.sin(now*(touch ? .008 : .013))*pulse;
      const idle=Math.sin(now*.0016)*.55;
      const px=this.parallaxX,py=this.parallaxY;
      const values={
        '--pick-rot-drift':`${(idle*1.15).toFixed(2)}deg`,
        '--tension-rot-drift':`${(idle*.95).toFixed(2)}deg`,
        '--pick-react-x':`${(this.row*-18+pulseSin*2.8+px*.30).toFixed(2)}px`,
        '--pick-react-y':`${(this.depth*13-pulse*3+py*.50).toFixed(2)}px`,
        '--pick-react-rot':`${(this.row*4.8+this.depth*3.2+pulseSin*2-px*.32-py*.24).toFixed(2)}deg`,
        '--tension-react-x':`${(this.row*9+pulseSin*1.5+px*.28).toFixed(2)}px`,
        '--tension-react-y':`${(this.depth*7-pulse*1.5+py*.28).toFixed(2)}px`,
        '--tension-react-rot':`${(this.row*-3+this.depth*2.3+pulseSin*1.25+px*.30+py*.16).toFixed(2)}deg`
      };
      for(const [name,value] of Object.entries(values))this.root.style.setProperty(name,value);
      return values;
    }
  }
  window.KeynlockToolMotionController=ToolMotionController;
