// Periodic smoothing keeps the wing beat continuous across the loop boundary.
export function smoothWingBeat(THREE,clip){
  const frames=Math.ceil(clip.duration*60),duration=clip.duration;
  const tracks=clip.tracks.map(track=>{
    const stride=track.getValueSize(),interpolant=track.createInterpolant();
    const values=new Float32Array((frames+1)*stride),times=new Float32Array(frames+1);
    const weights=[1,4,6,4,1],sample=new Float32Array(stride);
    for(let frame=0;frame<frames;frame++){
      const time=frame*duration/frames;
      const reference=Array.from(interpolant.evaluate(time));
      for(let tap=0;tap<5;tap++){
        const t=((time+(tap-2)*.018)%duration+duration)%duration;
        sample.set(interpolant.evaluate(t));
        const sign=track.ValueTypeName==='quaternion' && sample.reduce((sum,v,i)=>sum+v*reference[i],0)<0?-1:1;
        for(let k=0;k<stride;k++)values[frame*stride+k]+=sample[k]*weights[tap]*sign/16;
      }
      if(track.ValueTypeName==='quaternion'){
        const offset=frame*stride,norm=Math.hypot(...values.subarray(offset,offset+stride));
        for(let k=0;k<stride;k++)values[offset+k]/=norm;
      }
      times[frame]=time;
    }
    times[frames]=duration;values.set(values.subarray(0,stride),frames*stride);
    const result=track.clone();result.times=times;result.values=values;return result;
  });
  return new THREE.AnimationClip(clip.name,duration,tracks);
}
