import { listLabs, runLabCommand } from "../services/labSandboxService.mjs";
import { completeBeginnerLab, listBeginnerLabs, resolveTrainingActor, runBeginnerLab } from "../services/trainingService.mjs";

export const getSandboxLabs = () => listLabs();
export const executeSandboxCommand = async (payload) => runLabCommand(payload);
export const getBeginnerLabs = async () => listBeginnerLabs();
export const runBeginnerLabModule = async (actor, payload) => runBeginnerLab(actor, payload);
export const completeBeginnerLabModule = async (actor, payload) => completeBeginnerLab(actor, payload);
export const resolveLabsActor = ({ req }) => resolveTrainingActor({ req });

