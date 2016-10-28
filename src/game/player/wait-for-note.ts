﻿import { config, setParam } from "../../config/config";
import { INote } from "../midi-parser/i-midi-parser";

export class WaitForNote {

    private ids: number[];
    private notesPressedTime: number[][];
    private oldDT = 0;

    constructor(private notes: INote[][], private onNoteOn: (func: (noteId: number) => void) => void) {
        var o = this;
        o.assignIds();
        o.assignNotesPressedTime();
        onNoteOn(o.addNoteOnToKnownNotes);
    }

    isFreeze = () => {
        var o = this;
        var freeze = false;
        for (var trackId = 0; trackId < o.notes.length; trackId++) {
            var isWait = config.p_userHands[trackId] && config.p_waits[trackId];
            if (isWait) {
                while (!freeze && o.isIdBelowCurrentTimeMinusRadius(trackId, o.ids[trackId])) {
                    freeze = o.isNoteUnpressed(trackId, o.ids[trackId]);
                    if (!freeze) { o.ids[trackId]++ };
                }
            }
        }
        return freeze;
    }

    reset = (idsBelowCurrentTime: number[]) => {
        var o = this;
        o.resetNotesPressedTime(idsBelowCurrentTime);
        idsBelowCurrentTime.forEach(o.setId);
    }

    private assignIds = () => {
        var o = this;
        o.ids = o.notes.map(() => { return 0; });
    }

    private assignNotesPressedTime = () => {
        var o = this;
        o.notesPressedTime = o.notes.map((notesi) => {
            var arr = [];
            arr[notesi.length - 1] = undefined;
            return arr;
        });
    }

    private addNoteOnToKnownNotes = (noteId: number) => {
        var o = this;
        var firstNullTime = o.getFirstNullPressedTime();
        for (var i = 0; i < config.p_userHands.length; i++) {
            if (config.p_userHands[i]) {
                var id = o.ids[i];
                while (o.isIdBelowFirstTimePlusThreshold(i, id, firstNullTime)) {
                    var note = o.notes[i][id];
                    if (note.on && !o.notesPressedTime[i][id] && note.id === noteId) {
                        o.notesPressedTime[i][id] = config.p_elapsedTime;
                        o.modifySpeed(o.notes[i][id].time - config.p_elapsedTime)
                        return;
                    }
                    id++;
                }
            }
        }
    }

    private getFirstNullPressedTime = () => {
        var o = this;
        var minTime = 1e6;
        for (var i = 0; i < config.p_userHands.length; i++) {
            if (config.p_userHands[i]) {
                var id = o.ids[i];
                while (o.notes[i][id] && (o.notesPressedTime[i][id] || !o.notes[i][id].on)) { id++; } // chyba
                if (o.notes[i][id]) {
                    minTime = Math.min(o.notes[i][id].time, minTime);
                }
            }
        }
        return minTime;
    }

    private modifySpeed = (dt: number) => {
        var o = this;
        if (config.p_adaptableSpeed) {
            if (o.oldDT > 0) {
                // var scale = Math.abs(dt) / (1 * config.p_radius + o.oldDT);
                var newSpeedDiff = dt / 50000;
                var newSpeed = config.p_speed + newSpeedDiff;
                setParam("p_speed", newSpeed);
                console.log(config.p_elapsedTime + '\t' + dt + '\t' + newSpeed + '\t' + newSpeedDiff);
            }
            o.oldDT = Math.abs(dt);
        }
    }

    private isIdBelowFirstTimePlusThreshold = (trackId: number, noteId: number, nullTime: number) => {
        var o = this;
        return o.notes[trackId][noteId] &&
            o.notes[trackId][noteId].time < nullTime + 100;
    }

    private resetNotesPressedTime = (idsBelowCurrentTime: number[]) => {
        var o = this;
        for (var i = 0; i < idsBelowCurrentTime.length; i++) {
            for (var j = idsBelowCurrentTime[i] + 1; j < o.notesPressedTime[i].length; j++) {
                if (o.notesPressedTime[i][j]) {
                    o.notesPressedTime[i][j] = undefined;
                }
            }
        }
    }

    private setId = (id, i) => {
        var o = this;
        o.ids[i] = id + 1;
    }

    private isIdBelowCurrentTimeMinusRadius = (trackId: number, noteId: number) => {
        var o = this;
        return o.notes[trackId][noteId] &&
            o.notes[trackId][noteId].time < config.p_elapsedTime - config.p_wait_ms;
    }

    private isNoteUnpressed = (trackId: number, noteId: number) => {
        var o = this;
        var note = o.notes[trackId][noteId];
        var wasPlayedByUser = o.notesPressedTime[trackId][noteId];
        var waitForOutOfReach = true;
        if (!config.p_waitForOutOfReachNotes) {
            var isNoteAboveMin = note.id >= config.p_minNote;
            var isNoteBelowMax = note.id <= config.p_maxNote;
            waitForOutOfReach = isNoteAboveMin && isNoteBelowMax;
        }
        return note.on && !wasPlayedByUser && waitForOutOfReach;
    }

}