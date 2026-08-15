import { z } from "zod";
export const JobUpdateStatusSchema = z.object({
    status_id : z.string({error : "Status is Required"}).min(1 , "Status is Required") ,
    tracker_id : z.string({error : "Status is Required"}).min(1 , "Tracker is Required"),
});