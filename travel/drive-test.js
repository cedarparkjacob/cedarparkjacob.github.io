(() => {
const CLIENT_ID="515661449203-pqcnu9q8qpcmv4kpnksv6qai9t7dc26u.apps.googleusercontent.com";
const API_KEY="AIzaSyBoyoDVNQzeDHZOaLa0UsXsDhekAY8ql-Y";
const PROJECT_NUMBER="515661449203";
const SCOPE="https://www.googleapis.com/auth/drive.file";
let tokenClient=null,token=null,folder=null,pickerReady=false;
const el=id=>document.getElementById(id);
const status=s=>el("status").textContent=s;
function ready(){
 if(!window.google?.accounts?.oauth2||!pickerReady)return;
 tokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,callback:r=>{
  if(r.error){status("Authorization failed: "+r.error);return;}
  token=r.access_token;status("Connected. Select your Ludden Travel Photos folder.");el("chooseBtn").disabled=false;
 }});
 el("connectBtn").disabled=false;status("Google libraries ready. Connect your account to continue.");
}
window.addEventListener("load",()=>{
 const poll=setInterval(()=>{
  if(window.gapi?.load&&window.google?.accounts?.oauth2){
   clearInterval(poll);gapi.load("picker",{callback:()=>{pickerReady=true;ready();}});
  }
 },200);
 setTimeout(()=>clearInterval(poll),20000);
 el("connectBtn").addEventListener("click",()=>tokenClient&&tokenClient.requestAccessToken({prompt:""}));
 el("chooseBtn").addEventListener("click",openPicker);
 el("uploadFile").addEventListener("change",()=>{el("uploadBtn").disabled=!el("uploadFile").files.length||!folder;});
 el("uploadBtn").addEventListener("click",uploadPhoto);
});
function openPicker(){
 const view=new google.picker.DocsView(google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setIncludeFolders(true);
 new google.picker.PickerBuilder().setAppId(PROJECT_NUMBER).setDeveloperKey(API_KEY).setOAuthToken(token).setOrigin(window.location.origin).addView(view).setTitle("Choose Ludden Travel Photos").setCallback(async data=>{
  if(data.action!==google.picker.Action.PICKED)return;
  const d=data.docs?.[0];if(!d)return;folder={id:d.id,name:d.name};el("folder-info").textContent="Selected: "+d.name+" ("+d.id+")";await listFolder();
 }).build().setVisible(true);
}
async function api(url,options={}){
 const r=await fetch(url,{...options,headers:{Authorization:"Bearer "+token,...(options.headers||{})}});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error?.message||("HTTP "+r.status));return j;
}
async function listFolder(){
 try{
  status("Folder selected. Checking access…");
  const q=encodeURIComponent("'"+folder.id+"' in parents and trashed=false");
  const fields=encodeURIComponent("files(id,name,mimeType,size,modifiedTime),nextPageToken");
  const result=await api("https://www.googleapis.com/drive/v3/files?q="+q+"&pageSize=100&orderBy=name&fields="+fields);
  const list=el("file-list");list.replaceChildren();
  (result.files||[]).forEach(f=>{const card=document.createElement("div");card.className="file-item";const name=document.createElement("strong");name.textContent=f.name;const type=document.createElement("small");type.textContent=f.mimeType==="application/vnd.google-apps.folder"?"FOLDER":(f.mimeType||"FILE");card.append(name,type);list.append(card);});
  if(!result.files?.length)list.textContent="Folder is accessible, but no immediate child items were returned.";
  status("Success: listed "+(result.files||[]).length+" item(s)."+(result.nextPageToken?" More items are available.":""));
  el("uploadFile").disabled=false;el("uploadBtn").disabled=!el("uploadFile").files.length;
 }catch(e){status("Folder selected, but listing failed: "+e.message+"\nWe may need to adjust permissions or the selected-folder access approach.");}
}
async function uploadPhoto(){
 const file=el("uploadFile").files[0];if(!file||!folder)return;
 el("uploadBtn").disabled=true;status("Uploading "+file.name+"…");
 try{
  const boundary="ludden_travel_upload_boundary";
  const metadata={name:file.name,mimeType:file.type||"application/octet-stream",parents:[folder.id]};
  const body=new Blob(["--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n",JSON.stringify(metadata)+"\r\n--"+boundary+"\r\nContent-Type: "+(file.type||"application/octet-stream")+"\r\n\r\n",file,"\r\n--"+boundary+"--"]);
  const result=await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",{method:"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body});
  status("Upload succeeded: "+result.name+" (ID "+result.id+"). Refreshing folder list…");await listFolder();
 }catch(e){status("Upload failed: "+e.message);el("uploadBtn").disabled=false;}
}
})();