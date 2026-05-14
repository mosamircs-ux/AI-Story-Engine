import { Router, type IRouter } from "express";
import healthRouter from "./health";
import novelsRouter from "./novels";
import charactersRouter from "./characters";
import charactersListRouter from "./characters-list";
import eventsRouter from "./events";
import locationsRouter from "./locations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(novelsRouter);
router.use(charactersRouter);
router.use(charactersListRouter);
router.use(eventsRouter);
router.use(locationsRouter);

export default router;
