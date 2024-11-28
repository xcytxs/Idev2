import { useLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";
import type { FileMap } from "../stores/files";
import type { Snapshot } from "./types";
import { webcontainer } from "../webcontainer";
import { workbenchStore } from "../stores/workbench";




export function useSnapshot(chatId:string|undefined,chatIdx?:number) {
    const [snapshot, setSnapshot] = useState<Snapshot>();


    useEffect(() => {
        if (!chatId) {
            return;
        }
        let snapShotKey = `snapshot:${chatId}:${chatIdx}`;
        if (!chatIdx) snapShotKey = `snapshot:${chatId}`;

        let snapshotStr = localStorage.getItem(snapShotKey);
        if (!snapshotStr){
            setSnapshot(undefined);
            return
        }
        setSnapshot(JSON.parse(snapshotStr));
    }, [chatId]);

    const takeSnapshot=useCallback(async (chatIdx:number,files:FileMap,_chatId?:string|undefined)=>{
        let id=_chatId||chatId;
        if (!id) return;
        const snapshot:Snapshot={
            chatIndex:chatIdx,
            files
        }
        localStorage.setItem(`snapshot:${id}`,JSON.stringify(snapshot));
    }, [chatId])

    const restoreSnapshot=useCallback(async ()=>{
        if(!(snapshot?.files) ) return;
        Object.entries(snapshot.files).forEach(([key,value])=>{
            if(value?.type==="file"){
                workbenchStore.files.setKey(key,value);
            }
        })
        // workbenchStore.files.setKey(snapshot?.files)

    },[chatId,snapshot])
    return { snapshot, takeSnapshot, restoreSnapshot }
}