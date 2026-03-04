window.BxParticleCore = (function(){
  'use strict';
  const PHI = (1 + Math.sqrt(5)) / 2;

  // ── SHADERS ──
  const VERT = `
  attribute float size;
  attribute float aRandom;
  attribute float aSpeed;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uTime;
  uniform float uMorphProgress;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform float uWaveIntensity;
  uniform float uWaveType;
  uniform float uFlowSpeed;
  void main(){
    vColor=color;
    vec3 p=position;
    if(uWaveIntensity>0.0){
      float t=uTime*uFlowSpeed;
      float ySine=sin(p.x*0.5+t)*1.5+sin(p.x*1.2+t*1.5)*0.3;
      float yInt=sin(p.x*0.4+t)*1.2+cos(p.z*0.5+t*1.2)*1.0+sin((p.x+p.z)*0.8+t*2.0)*0.4;
      float yFlow=sin(p.x*0.2+t*0.8)*2.5+cos(p.x*0.1+t*0.5)*1.0;
      float yDisp;
      if(uWaveType<1.0){yDisp=mix(ySine,yInt,uWaveType);}
      else{yDisp=mix(yInt,yFlow,uWaveType-1.0);}
      p.y+=yDisp*uWaveIntensity;
    }
    float turb=(1.0-uMorphProgress*0.7)*(1.0-uWaveIntensity);
    float t2=uTime*0.4+aRandom*6.2831;
    p.x+=sin(t2*aSpeed)*0.025*turb;
    p.y+=cos(t2*0.7*aSpeed)*0.025*turb;
    p.z+=sin(t2*0.5+aRandom*3.14)*0.015*turb;
    if(uWaveIntensity<0.5){
      vec4 wp=modelMatrix*vec4(p,1.0);
      vec2 sp=(projectionMatrix*viewMatrix*wp).xy;
      float md=length(sp-uMouse)*2.0;
      float mf=smoothstep(0.8,0.0,md)*uMouseInfluence*0.15;
      p.x+=(uMouse.x-sp.x)*mf*0.3;
      p.y+=(uMouse.y-sp.y)*mf*0.3;
    }
    vec4 mv=modelViewMatrix*vec4(p,1.0);
    gl_Position=projectionMatrix*mv;
    float sa=size*(180.0/-mv.z);
    if(uWaveIntensity>0.5)sa*=0.7;
    gl_PointSize=clamp(sa,0.3,4.0);
    float dist=length(mv.xyz);
    vAlpha=smoothstep(50.0,3.0,dist)*(0.4+0.4*aRandom);
  }`;
  const FRAG = `
  varying vec3 vColor;
  varying float vAlpha;
  void main(){
    float d=length(gl_PointCoord-0.5);
    if(d>0.5)discard;
    float core=smoothstep(0.5,0.05,d);
    float glow=smoothstep(0.5,0.25,d);
    float alpha=(core*0.7+glow*0.25)*vAlpha;
    gl_FragColor=vec4(vColor,alpha);
  }`;

  // ── POSITION GENERATORS ──
  function generateChaos(count, radius){
    const pts=[], arms=5;
    for(let i=0;i<count;i++){
      const t=i/count, arm=i%arms, off=(arm/arms)*Math.PI*2;
      const angle=t*Math.PI*8+off, r=Math.pow(t,0.55)*radius;
      const spread=(1-t*0.6)*0.8;
      const dx=(Math.sin(i*PHI*7.3)-0.5)*spread;
      const dy=(Math.sin(i*PHI*11.1)-0.5)*spread;
      pts.push(new THREE.Vector3(r*Math.cos(angle)+dx,r*Math.sin(angle)*0.4+dy,(Math.sin(i*PHI*3.7)-0.5)*r*0.12));
    }
    return pts;
  }

  function generateAmbient(count){
    const pts=[];
    for(let i=0;i<count;i++){
      const t=i/count, theta=2*Math.PI*i/PHI, phi=Math.acos(1-2*t);
      const shell=Math.floor(i*3.7%4);
      const r=5+shell*3.5+Math.sin(i*PHI*0.1)*1.5;
      pts.push(new THREE.Vector3(r*Math.sin(phi)*Math.cos(theta),r*Math.sin(phi)*Math.sin(theta),r*Math.cos(phi)));
    }
    return pts;
  }

  function generateSingleBuilding(count){
    const pts=[], w=2.0,h=4.0,d=1.5, floors=8, cx=0,cy=-2.0;
    for(let i=0;i<count;i++){
      const t=i/count; let x,y,z;
      if(t<0.35){const edge=Math.floor(t/0.0875),et=(t%0.0875)/0.0875;
        const ex=(edge%2===0?-1:1)*w/2, ez=(edge<2?-1:1)*d/2;
        x=cx+ex+(Math.random()-0.5)*0.06;y=cy+et*h+(Math.random()-0.5)*0.06;z=ez+(Math.random()-0.5)*0.06;
      }else if(t<0.6){const ft=(t-0.35)/0.25, floor=Math.floor(ft*floors);
        const floorY=cy+(floor/floors)*h, side=Math.floor((ft*floors-floor)*4);
        const st=(ft*floors-floor)*4-side;
        if(side<2){x=cx+(st-0.5)*w;z=(side===0?-1:1)*d/2;}
        else{z=(st-0.5)*d;x=cx+(side===2?-1:1)*w/2;}
        y=floorY+(Math.random()-0.5)*0.04;x+=(Math.random()-0.5)*0.04;z+=(Math.random()-0.5)*0.04;
      }else if(t<0.85){const face=Math.floor(Math.random()*4),u=Math.random(),v=Math.random();
        if(face<2){x=cx+(u-0.5)*w;y=cy+v*h;z=(face===0?-1:1)*d/2+(Math.random()-0.5)*0.08;}
        else{z=(u-0.5)*d;y=cy+v*h;x=cx+(face===2?-1:1)*w/2+(Math.random()-0.5)*0.08;}
      }else{x=cx+(Math.random()-0.5)*w;z=(Math.random()-0.5)*d;y=cy+h+(Math.random()-0.5)*0.04;}
      pts.push(new THREE.Vector3(x,y,z));
    }
    return pts;
  }

  function generateBuildingCluster(count){
    const pts=[], blds=[
      {cx:-2,cy:-1.8,w:1.2,h:2.8,d:0.8},{cx:0,cy:-1.8,w:1.4,h:3.5,d:1},{cx:2,cy:-1.8,w:1.0,h:2.2,d:0.7}];
    const bCnt=Math.floor(count*0.65),rCnt=Math.floor(count*0.1),aCnt=count-bCnt-rCnt;
    const perB=Math.floor(bCnt/3);
    for(let b=0;b<3;b++){const{cx,cy,w,h,d}=blds[b];
      for(let i=0;i<perB;i++){const t=i/perB;let x,y,z;
        if(t<0.5){const floor=Math.floor(t*12),floorY=cy+(floor/6)*h;
          x=cx+(Math.random()-0.5)*w;y=floorY+(Math.random()-0.5)*0.05;z=(Math.random()-0.5)*d;}
        else{const face=Math.floor(Math.random()*4),u=Math.random(),v=Math.random();
          if(face<2){x=cx+(u-0.5)*w;y=cy+v*h;z=(face===0?-1:1)*d/2;}
          else{z=(u-0.5)*d;y=cy+v*h;x=cx+(face===2?-1:1)*w/2;}}
        pts.push(new THREE.Vector3(x,y,z));}}
    for(let i=0;i<rCnt;i++){const b=blds[i%3];
      pts.push(new THREE.Vector3(b.cx+(Math.random()-0.5)*b.w,b.cy+b.h+(Math.random()-0.5)*0.04,(Math.random()-0.5)*b.d));}
    for(let i=0;i<aCnt;i++){const pair=i%3,from=blds[pair===2?0:pair],to=blds[pair===2?2:pair+1];
      const t=(i/aCnt)*3-pair,ct=Math.max(0,Math.min(1,t));
      const midY=Math.max(from.cy+from.h,to.cy+to.h)+0.5;
      const x=from.cx+(to.cx-from.cx)*ct,y=from.cy+from.h*0.7+Math.sin(ct*Math.PI)*(midY-from.cy)*0.7;
      pts.push(new THREE.Vector3(x,y,(Math.random()-0.5)*0.3));}
    while(pts.length<count){const b=blds[Math.floor(Math.random()*3)];
      pts.push(new THREE.Vector3(b.cx+(Math.random()-0.5)*b.w,b.cy+Math.random()*b.h,(Math.random()-0.5)*b.d));}
    return pts;
  }

  function generateGrowthBuildings(count){
    const pts=[], blds=[
      {cx:-2,cy:-1.8,w:1.2,h:3.0,d:0.8},{cx:0,cy:-1.8,w:1.4,h:3.8,d:1},{cx:2,cy:-1.8,w:1.0,h:2.5,d:0.7}];
    const bPart=Math.floor(count*0.5),rPart=Math.floor(count*0.1),fPart=count-bPart-rPart;
    const perB=Math.floor(bPart/3);
    for(let b=0;b<3;b++){const{cx,cy,w,h,d}=blds[b];
      for(let i=0;i<perB;i++){const face=Math.floor(Math.random()*4),u=Math.random(),v=Math.random();let x,y,z;
        if(face<2){x=cx+(u-0.5)*w;y=cy+v*h;z=(face===0?-1:1)*d/2;}
        else{z=(u-0.5)*d;y=cy+v*h;x=cx+(face===2?-1:1)*w/2;}
        pts.push(new THREE.Vector3(x,y,z));}}
    for(let i=0;i<rPart;i++){const b=blds[i%3];
      pts.push(new THREE.Vector3(b.cx+(Math.random()-0.5)*b.w,b.cy+b.h+(Math.random()-0.5)*0.04,(Math.random()-0.5)*b.d));}
    for(let i=0;i<fPart;i++){const b=blds[i%3];const face=Math.floor(Math.random()*4),u=Math.random(),v=Math.random();
      let x,y,z;if(face<2){x=b.cx+(u-0.5)*b.w;y=b.cy+v*b.h;z=(face===0?-1:1)*b.d/2;}
      else{z=(u-0.5)*b.d;y=b.cy+v*b.h;x=b.cx+(face===2?-1:1)*b.w/2;}
      pts.push(new THREE.Vector3(x,y,z));}
    while(pts.length<count){const b=blds[Math.floor(Math.random()*3)];
      pts.push(new THREE.Vector3(b.cx+(Math.random()-0.5)*b.w,b.cy+Math.random()*b.h,(Math.random()-0.5)*b.d));}
    return pts;
  }

  function generateTextShape(count, text, scale){
    scale=scale||5;
    const canvas2=document.createElement('canvas'), res=256;
    const lines=text.split('\n'), numLines=lines.length;
    const tmp=document.createElement('canvas');tmp.width=1;tmp.height=1;
    const tmpCtx=tmp.getContext('2d');
    const lineH=Math.round(res*0.4), fontSize=Math.round(lineH*0.7);
    tmpCtx.font=`bold ${fontSize}px gotham,Arial,sans-serif`;
    let maxW=0; for(const l of lines){const w=Math.ceil(tmpCtx.measureText(l).width);if(w>maxW)maxW=w;}
    canvas2.width=Math.max(res,maxW+40); canvas2.height=lineH*numLines;
    const ctx=canvas2.getContext('2d');
    ctx.fillStyle='#000';ctx.fillRect(0,0,canvas2.width,canvas2.height);
    ctx.fillStyle='#fff';ctx.font=`bold ${fontSize}px gotham,Arial,sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(let li=0;li<numLines;li++)ctx.fillText(lines[li],canvas2.width/2,lineH*li+lineH/2);
    const imgD=ctx.getImageData(0,0,canvas2.width,canvas2.height), px=imgD.data;
    const valid=[];
    for(let y=0;y<canvas2.height;y++)for(let x=0;x<canvas2.width;x++){const i=(y*canvas2.width+x)*4;if(px[i]>128)valid.push({x,y});}
    const pts=[], aspect=canvas2.width/canvas2.height;
    for(let i=0;i<count;i++){
      if(valid.length>0){const p=valid[Math.floor(Math.random()*valid.length)];
        pts.push(new THREE.Vector3(((p.x/canvas2.width)-0.5)*scale,(0.5-(p.y/canvas2.height))*(scale/aspect)+0.5,(Math.random()-0.5)*0.2));}
      else pts.push(new THREE.Vector3((Math.random()-0.5)*scale,(Math.random()-0.5)*2,(Math.random()-0.5)*0.3));}
    return pts;
  }

  function generateCityGrid(count){
    const pts=[], gridSize=4, spacing=2.2, blds=[];
    for(let gx=0;gx<gridSize;gx++)for(let gz=0;gz<gridSize;gz++){
      const cx=(gx-gridSize/2+0.5)*spacing, cz=(gz-gridSize/2+0.5)*spacing;
      const h=0.8+Math.sin(gx*2.1+gz*3.7)*0.5+Math.random()*1.2;
      blds.push({cx,cz,w:0.8,d:0.8,h});}
    const perB=Math.floor(count*0.85/blds.length);
    for(const b of blds)for(let i=0;i<perB;i++){const t=i/perB;let x,y,z;
      if(t<0.3){x=b.cx+(Math.random()-0.5)*b.w;z=b.cz+(Math.random()-0.5)*b.d;y=b.h+(Math.random()-0.5)*0.03;}
      else if(t<0.7){const face=Math.floor(Math.random()*4),u=Math.random();
        if(face<2){x=b.cx+(u-0.5)*b.w;z=b.cz+(face===0?-1:1)*b.d/2;}
        else{z=b.cz+(u-0.5)*b.d;x=b.cx+(face===2?-1:1)*b.w/2;}y=Math.random()*b.h;}
      else{x=b.cx+(Math.random()-0.5)*b.w*1.3;z=b.cz+(Math.random()-0.5)*b.d*1.3;y=(Math.random()-0.5)*0.02;}
      pts.push(new THREE.Vector3(x,y,z));}
    const rem=count-pts.length;
    for(let i=0;i<rem;i++){const isX=Math.random()>0.5, si=Math.floor(Math.random()*(gridSize+1));
      const pos=(si-gridSize/2)*spacing, along=(Math.random()-0.5)*gridSize*spacing;
      if(isX)pts.push(new THREE.Vector3(along,0.01,pos+(Math.random()-0.5)*0.1));
      else pts.push(new THREE.Vector3(pos+(Math.random()-0.5)*0.1,0.01,along));}
    while(pts.length<count)pts.push(new THREE.Vector3((Math.random()-0.5)*gridSize*spacing,Math.random()*0.5,(Math.random()-0.5)*gridSize*spacing));
    return pts;
  }

  function generateFlatGrid(count){
    const pts=[], side=Math.ceil(Math.sqrt(count)), sp=0.15, off=(side*sp)/2;
    for(let i=0;i<count;i++){const r=Math.floor(i/side),c=i%side;
      pts.push(new THREE.Vector3(c*sp-off,0,r*sp-off));}
    return pts;
  }

  function generateScatteredData(count){
    const pts=[];
    for(let i=0;i<count;i++){const t=i/count, theta=2*Math.PI*i*0.618, phi=Math.acos(1-2*t);
      const r=2+Math.random()*4;
      pts.push(new THREE.Vector3(r*Math.sin(phi)*Math.cos(theta)+(Math.random()-0.5)*1.5,
        r*Math.sin(phi)*Math.sin(theta)*0.6+(Math.random()-0.5)*1.5,(Math.random()-0.5)*3));}
    return pts;
  }

  var HELMET_B64='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';

  var _helmetCache = null;
  function decodeHelmetSeeds(){
    if(_helmetCache)return _helmetCache;
    const raw=atob(HELMET_B64);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const i16=new Int16Array(bytes.buffer);
    const count=i16.length/3;
    const pts=new Float32Array(count*3);
    for(let j=0;j<count;j++){
      pts[j*3]=i16[j*3]/32767.0*2.0;
      pts[j*3+1]=i16[j*3+1]/32767.0*2.0;
      pts[j*3+2]=i16[j*3+2]/32767.0*2.0;
    }
    _helmetCache=pts;
    return pts;
  }

  function generateHelmetShape(count){
    const seeds=decodeHelmetSeeds();
    const seedCount=seeds.length/3;
    const pts=[];
    for(let i=0;i<count;i++){
      const src=(i<seedCount)?i:Math.floor(Math.random()*seedCount);
      const s3=src*3;
      const jitter=(i<seedCount)?0.005:0.02;
      pts.push(new THREE.Vector3(
        seeds[s3]+(Math.random()-0.5)*jitter,
        seeds[s3+1]+(Math.random()-0.5)*jitter,
        seeds[s3+2]+(Math.random()-0.5)*jitter
      ));
    }
    return pts;
  }

  function generateBuildingUrgentFix(count){
    const pts=[];
    const nLower=Math.floor(count*0.30);
    const nTop=Math.floor(count*0.50);
    const nPipe=Math.floor(count*0.06);
    const nWater=count-nLower-nTop-nPipe;

    const BW=2.0,BH=4.0,BD=1.5,BCX=0,BCY=-2.0,FLOORS=8;
    const TOP_Y0=1.2,TOP_Y1=BCY+BH;

    const PIPE_R=0.04,PIPE_Z=-0.70;
    const PIPE_VX=0.3,PIPE_VY0=1.50,PIPE_VY1=1.85;
    const PIPE_HX0=-0.4,PIPE_HX1=0.3,PIPE_HY=1.85;
    const BREAK={x:0.3,y:1.85,z:-0.70};

    for(let i=0;i<nLower;i++){
      const t=i/nLower;
      let x,y,z;
      if(t<0.35){
        const edge=Math.floor(t/0.0875),et=(t%0.0875)/0.0875;
        const ex=(edge%2===0?-1:1)*BW/2,ez=(edge<2?-1:1)*BD/2;
        x=BCX+ex+(Math.random()-0.5)*0.06;
        y=BCY+et*(TOP_Y0-BCY)+(Math.random()-0.5)*0.06;
        z=ez+(Math.random()-0.5)*0.06;
      }else if(t<0.6){
        const ft=(t-0.35)/0.25,floor=Math.floor(ft*6);
        const floorY=BCY+(floor/6)*(TOP_Y0-BCY),side=Math.floor((ft*6-floor)*4);
        const st=(ft*6-floor)*4-side;
        if(side<2){x=BCX+(st-0.5)*BW;z=(side===0?-1:1)*BD/2;}
        else{z=(st-0.5)*BD;x=BCX+(side===2?-1:1)*BW/2;}
        y=floorY+(Math.random()-0.5)*0.04;
        x+=(Math.random()-0.5)*0.04;
        z+=(Math.random()-0.5)*0.04;
      }else{
        const face=Math.floor(Math.random()*4),u=Math.random(),v=Math.random();
        if(face<2){
          x=BCX+(u-0.5)*BW;
          y=BCY+v*(TOP_Y0-BCY);
          z=(face===0?-1:1)*BD/2+(Math.random()-0.5)*0.08;
        }else{
          z=(u-0.5)*BD;
          y=BCY+v*(TOP_Y0-BCY);
          x=BCX+(face===2?-1:1)*BW/2+(Math.random()-0.5)*0.08;
        }
      }
      pts.push(new THREE.Vector3(x,y,z));
    }

    for(let i=0;i<nTop;i++){
      const t=i/nTop;
      let x,y,z;
      if(t<0.15){
        const edge=Math.floor(t/0.0375),et=(t%0.0375)/0.0375;
        const ex=(edge%2===0?-1:1)*BW/2,ez=(edge<2?-1:1)*BD/2;
        x=BCX+ex+(Math.random()-0.5)*0.04;
        y=TOP_Y0+et*(TOP_Y1-TOP_Y0)+(Math.random()-0.5)*0.04;
        z=ez+(Math.random()-0.5)*0.04;
      }else if(t<0.35){
        const ft=(t-0.15)/0.2,floor=Math.floor(ft*2);
        const floorY=TOP_Y0+(floor/2)*(TOP_Y1-TOP_Y0),side=Math.floor((ft*2-floor)*4);
        const st=(ft*2-floor)*4-side;
        if(side<2){x=BCX+(st-0.5)*BW;z=(side===0?-1:1)*BD/2;}
        else{z=(st-0.5)*BD;x=BCX+(side===2?-1:1)*BW/2;}
        y=floorY+(Math.random()-0.5)*0.03;
        x+=(Math.random()-0.5)*0.03;
        z+=(Math.random()-0.5)*0.03;
      }else if(t<0.75){
        const face=Math.floor(Math.random()*4),u=Math.random(),v=Math.random();
        if(face<2){
          x=BCX+(u-0.5)*BW;
          y=TOP_Y0+v*(TOP_Y1-TOP_Y0);
          z=(face===0?-1:1)*BD/2+(Math.random()-0.5)*0.06;
        }else{
          z=(u-0.5)*BD;
          y=TOP_Y0+v*(TOP_Y1-TOP_Y0);
          x=BCX+(face===2?-1:1)*BW/2+(Math.random()-0.5)*0.06;
        }
      }else{
        x=BCX+(Math.random()-0.5)*BW;
        z=(Math.random()-0.5)*BD;
        y=TOP_Y1+(Math.random()-0.5)*0.03;
      }
      pts.push(new THREE.Vector3(x,y,z));
    }

    const nPipeV=Math.floor(nPipe*0.45);
    const nPipeH=Math.floor(nPipe*0.45);
    for(let i=0;i<nPipe;i++){
      let x,y,z;
      if(i<nPipeV){
        const t=i/nPipeV;
        x=PIPE_VX+(Math.random()-0.5)*PIPE_R*2;
        y=PIPE_VY0+t*(PIPE_VY1-PIPE_VY0);
        z=PIPE_Z+(Math.random()-0.5)*PIPE_R*2;
      }else if(i<nPipeV+nPipeH){
        const t=(i-nPipeV)/nPipeH;
        x=PIPE_HX0+t*(PIPE_HX1-PIPE_HX0);
        y=PIPE_HY+(Math.random()-0.5)*PIPE_R*2;
        z=PIPE_Z+(Math.random()-0.5)*PIPE_R*2;
      }else{
        const angle=Math.random()*Math.PI*2,r=Math.random()*PIPE_R*3;
        x=BREAK.x+Math.cos(angle)*r;
        y=BREAK.y+Math.sin(angle)*r;
        z=BREAK.z+(Math.random()-0.5)*PIPE_R*2;
      }
      pts.push(new THREE.Vector3(x,y,z));
    }

    for(let i=0;i<nWater;i++){
      pts.push(new THREE.Vector3(
        BREAK.x+(Math.random()-0.5)*0.02,
        BREAK.y+(Math.random()-0.5)*0.02,
        BREAK.z+(Math.random()-0.5)*0.02
      ));
    }

    return pts;
  }

  function generateBuildingSidewalk(count){
    const pts=[];
    const nBuilding=Math.floor(count*0.5);
    const nSidewalk=count-nBuilding;
    const w=2.0,h=4.0,d=1.5,cx=0,cy=-2.0,floors=8;

    for(let i=0;i<nBuilding;i++){
      const t=i/nBuilding;
      let x,y,z;
      if(t<0.35){
        const edge=Math.floor(t/0.0875),et=(t%0.0875)/0.0875;
        const ex=(edge%2===0?-1:1)*w/2,ez=(edge<2?-1:1)*d/2;
        x=cx+ex+(Math.random()-0.5)*0.06;
        y=cy+et*h+(Math.random()-0.5)*0.06;
        z=ez+(Math.random()-0.5)*0.06;
      }else if(t<0.6){
        const ft=(t-0.35)/0.25,floor=Math.floor(ft*floors);
        const floorY=cy+(floor/floors)*h,side=Math.floor((ft*floors-floor)*4);
        const st=(ft*floors-floor)*4-side;
        if(side<2){x=cx+(st-0.5)*w;z=(side===0?-1:1)*d/2;}
        else{z=(st-0.5)*d;x=cx+(side===2?-1:1)*w/2;}
        y=floorY+(Math.random()-0.5)*0.04;
        x+=(Math.random()-0.5)*0.04;
        z+=(Math.random()-0.5)*0.04;
      }else if(t<0.85){
        const face=Math.floor(Math.random()*4),u=Math.random(),v=Math.random();
        if(face<2){
          x=cx+(u-0.5)*w;
          y=cy+v*h;
          z=(face===0?-1:1)*d/2+(Math.random()-0.5)*0.08;
        }else{
          z=(u-0.5)*d;
          y=cy+v*h;
          x=cx+(face===2?-1:1)*w/2+(Math.random()-0.5)*0.08;
        }
      }else{
        x=cx+(Math.random()-0.5)*w;
        z=(Math.random()-0.5)*d;
        y=cy+h+(Math.random()-0.5)*0.04;
      }
      pts.push(new THREE.Vector3(x,y,z));
    }

    const swMargin=0.8;
    const swInnerW=w/2,swInnerD=d/2;
    const swOuterW=w/2+swMargin,swOuterD=d/2+swMargin;
    for(let i=0;i<nSidewalk;i++){
      let sx,sz;
      do{
        sx=(Math.random()-0.5)*swOuterW*2;
        sz=(Math.random()-0.5)*swOuterD*2;
      }while(Math.abs(sx)<swInnerW&&Math.abs(sz)<swInnerD);
      pts.push(new THREE.Vector3(cx+sx,cy+(Math.random()-0.5)*0.03,sz));
    }

    return pts;
  }

  // ── SVG TO POINTS ──
  function parseSVGToPoints(svgText, numPoints, scale, offsetX, offsetY){
    const parser=new DOMParser(), doc=parser.parseFromString(svgText,'image/svg+xml');
    const svgEl=doc.querySelector('svg');
    const vb=svgEl.getAttribute('viewBox').split(' ').map(Number);
    const svgW=vb[2],svgH=vb[3];
    const canvas=document.createElement('canvas');
    // Use higher resolution so both axes get enough pixels for detail.
    // For wide SVGs (e.g. 4:1), a fixed 256px width yields only ~60px height,
    // losing vertical detail. Ensure the shorter axis is at least 256px.
    const aspect=svgW/svgH;
    var resW,resH;
    if(aspect>=1){resH=256;resW=Math.round(256*aspect);}
    else{resW=256;resH=Math.round(256/aspect);}
    canvas.width=resW;canvas.height=resH;
    const ctx=canvas.getContext('2d');
    return new Promise(resolve=>{
      const img=new Image(), blob=new Blob([svgText],{type:'image/svg+xml'}), url=URL.createObjectURL(blob);
      img.onload=()=>{ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
        const id=ctx.getImageData(0,0,canvas.width,canvas.height),px=id.data,valid=[];
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if(px[i+3]>128)valid.push({x,y});}
        const pts=[],aspect=canvas.width/canvas.height;
        for(let i=0;i<numPoints;i++){if(valid.length>0){const p=valid[Math.floor(Math.random()*valid.length)];
          pts.push(new THREE.Vector3(((p.x/canvas.width)-0.5)*scale+offsetX,(0.5-(p.y/canvas.height))*(scale/aspect)+offsetY,(Math.random()-0.5)*0.15));}
          else pts.push(new THREE.Vector3((Math.random()-0.5)*scale+offsetX,(Math.random()-0.5)*scale+offsetY,(Math.random()-0.5)*0.2));}
        resolve(pts);};
      img.onerror=()=>{URL.revokeObjectURL(url);const pts=[];
        for(let i=0;i<numPoints;i++)pts.push(new THREE.Vector3((Math.random()-0.5)*scale+offsetX,(Math.random()-0.5)*scale+offsetY,(Math.random()-0.5)*0.2));
        resolve(pts);};
      img.src=url;});
  }

  // ── COLORS ──
  const COLORS = {
    primary: new THREE.Color('#a2c62e'),
    primaryBright: new THREE.Color('#d4ff60'),
    white: new THREE.Color('#e0e0e0'),
    dim: new THREE.Color('#222222'),
  };

  // ── FACTORY ──
  // Creates a self-contained particle system on a given canvas
  // Returns {scene, camera, renderer, particles, geo, mat, N, pos, tgt, col, rnd, spd, setTarget, setColor, destroy, animate}
  function create(canvas, config){
    config = Object.assign({count:25000, size:0.3, fov:55, camZ:9, rotate:false, waveMode:false}, config);
    const N = config.count;

    // WebGL availability check — gracefully skip if not supported
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) {
      console.warn('[BxParticle] WebGL not available, skipping particle system');
      return null;
    }

    const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, powerPreference:'high-performance'});
    const rect = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(config.fov, rect.width/rect.height, 0.1, 100);
    camera.position.z = config.camZ;

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N*3), tgt = new Float32Array(N*3);
    const col = new Float32Array(N*3), szs = new Float32Array(N);
    const rnd = new Float32Array(N), spd = new Float32Array(N);
    const targetColors = new Float32Array(N*3);
    let colorsDirty = false;

    // Init with chaos
    const initial = generateChaos(N, 14);
    for(let i=0;i<N;i++){
      pos[i*3]=initial[i].x;pos[i*3+1]=initial[i].y;pos[i*3+2]=initial[i].z;
      tgt[i*3]=initial[i].x;tgt[i*3+1]=initial[i].y;tgt[i*3+2]=initial[i].z;
      col[i*3]=0.8;col[i*3+1]=0.8;col[i*3+2]=0.8;
      szs[i]=config.size*(0.3+Math.random()*0.7);
      rnd[i]=Math.random();spd[i]=0.5+Math.random()*0.5;
    }
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    geo.setAttribute('size',new THREE.BufferAttribute(szs,1));
    geo.setAttribute('aRandom',new THREE.BufferAttribute(rnd,1));
    geo.setAttribute('aSpeed',new THREE.BufferAttribute(spd,1));

    const mat = new THREE.ShaderMaterial({
      vertexShader:VERT, fragmentShader:FRAG,
      uniforms:{uTime:{value:0},uMorphProgress:{value:0},uMouse:{value:new THREE.Vector2(0,0)},
        uMouseInfluence:{value:0},uWaveIntensity:{value:config.waveMode?1:0},
        uWaveType:{value:0},uFlowSpeed:{value:1}},
      vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending});
    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    let time=0, lastFrame=0, destroyed=false, rafId=null;

    function setTarget(points){
      for(let i=0;i<N;i++){
        const idx=i%points.length;
        tgt[i*3]=points[idx].x;tgt[i*3+1]=points[idx].y;tgt[i*3+2]=points[idx].z;
      }
      mat.uniforms.uMorphProgress.value=0.9;
    }

    function setColor(base, accent, ratio){
      for(let i=0;i<N;i++){const c=rnd[i]<ratio?accent:base;
        targetColors[i*3]=c.r;targetColors[i*3+1]=c.g;targetColors[i*3+2]=c.b;}
      colorsDirty=true;
    }

    function tick(now){
      if(destroyed)return;
      rafId=requestAnimationFrame(tick);
      if(!now)now=performance.now();
      const dt=lastFrame?Math.min((now-lastFrame)/1000,0.05):0.016;
      lastFrame=now;
      time+=dt;
      mat.uniforms.uTime.value=time;

      const posArr=geo.attributes.position.array;
      const lp=1-Math.pow(1-0.12,dt*60);
      for(let i=0;i<N;i++){const s=spd[i]*lp,i3=i*3;
        posArr[i3]+=(tgt[i3]-posArr[i3])*s;
        posArr[i3+1]+=(tgt[i3+1]-posArr[i3+1])*s;
        posArr[i3+2]+=(tgt[i3+2]-posArr[i3+2])*s;}
      geo.attributes.position.needsUpdate=true;

      if(colorsDirty){const c=geo.attributes.color.array;
        const cl=1-Math.pow(1-0.12,dt*60);let done=true;
        for(let i=0;i<N*3;i++){const diff=targetColors[i]-c[i];
          if(Math.abs(diff)>0.001){c[i]+=diff*cl;done=false;}else c[i]=targetColors[i];}
        geo.attributes.color.needsUpdate=true;if(done)colorsDirty=false;}

      if(config.rotate)particles.rotation.y+=dt*0.3;
      camera.position.x=Math.sin(time*0.08)*0.12;
      camera.position.y=Math.cos(time*0.06)*0.08;
      camera.lookAt(0,0,0);
      renderer.render(scene,camera);
    }

    function startAnim(){if(!destroyed&&!rafId)tick();}
    function stopAnim(){if(rafId){cancelAnimationFrame(rafId);rafId=null;}}

    function destroy(){
      destroyed=true;stopAnim();
      geo.dispose();mat.dispose();renderer.dispose();renderer.forceContextLoss();
    }

    function resize(){
      const r=canvas.parentElement.getBoundingClientRect();
      camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
      renderer.setSize(r.width,r.height);
    }

    return {scene,camera,renderer,particles,geo,mat,N,pos,tgt,col,rnd,spd,
      setTarget,setColor,startAnim,stopAnim,destroy,resize,
      generateChaos,generateAmbient,generateSingleBuilding,generateBuildingCluster,
      generateGrowthBuildings,generateTextShape,generateCityGrid,generateFlatGrid,
      generateScatteredData,generateHelmetShape,generateBuildingUrgentFix,generateBuildingSidewalk,parseSVGToPoints,COLORS,time:()=>time,
      getPositions: function () {
        var arr = geo.attributes.position.array;
        var pts = [];
        for (var i = 0; i < N; i++) {
          pts.push(new THREE.Vector3(arr[i*3], arr[i*3+1], arr[i*3+2]));
        }
        return pts;
      },
      scatter: function (radius, duration) {
        var scattered = generateChaos(N, radius || 15);
        this.setTarget(scattered);
        return gsap.to(mat.uniforms.uMorphProgress, {
          value: 0.3, duration: duration || 0.8, ease: 'power2.in'
        });
      }};
  }

  return {create,generateChaos,generateAmbient,generateSingleBuilding,generateBuildingCluster,
    generateGrowthBuildings,generateTextShape,generateCityGrid,generateFlatGrid,
    generateScatteredData,generateHelmetShape,generateBuildingUrgentFix,generateBuildingSidewalk,parseSVGToPoints,COLORS,PHI};
})();
