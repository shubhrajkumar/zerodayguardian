import argparse
import os
from sqlalchemy.orm import Session

from db import SessionLocal
from models import LearningPath, ModuleLesson, PathModule, RewardsCatalog, SkillGraphNode


def seed_learning_paths(db: Session) -> None:
    if db.query(LearningPath).count() > 0:
        return

    paths = [
        LearningPath(
            slug="defense-foundations",
            title="Defense Foundations",
            description="Core defensive skills: asset inventory, baseline hardening, logging, and response fundamentals.",
            difficulty="beginner",
            track="defense",
            version=1,
        ),
        LearningPath(
            slug="offense-foundations",
            title="Offense Foundations",
            description="Recon, web attack surface discovery, and safe adversary simulation foundations.",
            difficulty="beginner",
            track="offense",
            version=1,
        ),
        LearningPath(
            slug="threat-hunting-loop",
            title="Threat Hunting Loop",
            description="Signal triage, anomaly validation, and containment playbooks for operations teams.",
            difficulty="intermediate",
            track="defense",
            version=1,
        ),
    ]
    db.add_all(paths)
    db.commit()

    modules = [
        PathModule(path_id=paths[0].id, title="Asset & Identity Baseline", summary="Know what you own, and who can access it.", order_index=1, estimated_minutes=25),
        PathModule(path_id=paths[0].id, title="Defensive Monitoring", summary="Signals, alerts, and response context.", order_index=2, estimated_minutes=30),
        PathModule(path_id=paths[1].id, title="Recon & Enumeration", summary="Understand the exposed surface safely.", order_index=1, estimated_minutes=30),
        PathModule(path_id=paths[1].id, title="Web Attack Simulation", summary="Simulate web flows in a safe lab.", order_index=2, estimated_minutes=35),
        PathModule(path_id=paths[2].id, title="Threat Signal Validation", summary="Separate noise from risk.", order_index=1, estimated_minutes=25),
        PathModule(path_id=paths[2].id, title="Containment Playbooks", summary="Close the loop with actionable steps.", order_index=2, estimated_minutes=30),
    ]
    db.add_all(modules)
    db.commit()

    lessons = [
        ModuleLesson(module_id=modules[0].id, title="Asset inventory checklist", content_ref="lesson:defense/inventory", lesson_type="reading", order_index=1, estimated_minutes=10),
        ModuleLesson(module_id=modules[0].id, title="Identity drift review", content_ref="lesson:defense/identity", lesson_type="exercise", order_index=2, estimated_minutes=15),
        ModuleLesson(module_id=modules[1].id, title="Signal taxonomy", content_ref="lesson:defense/signals", lesson_type="reading", order_index=1, estimated_minutes=12),
        ModuleLesson(module_id=modules[1].id, title="Alert triage drill", content_ref="lesson:defense/triage", lesson_type="lab", order_index=2, estimated_minutes=18),
        ModuleLesson(module_id=modules[2].id, title="Recon mapping", content_ref="lesson:offense/recon", lesson_type="reading", order_index=1, estimated_minutes=12),
        ModuleLesson(module_id=modules[2].id, title="DNS & WHOIS practice", content_ref="lesson:offense/dns", lesson_type="lab", order_index=2, estimated_minutes=18),
        ModuleLesson(module_id=modules[3].id, title="Web surface modeling", content_ref="lesson:offense/web-model", lesson_type="reading", order_index=1, estimated_minutes=15),
        ModuleLesson(module_id=modules[3].id, title="Auth flow simulation", content_ref="lesson:offense/auth-sim", lesson_type="lab", order_index=2, estimated_minutes=20),
        ModuleLesson(module_id=modules[4].id, title="Threat signal triage", content_ref="lesson:hunt/triage", lesson_type="exercise", order_index=1, estimated_minutes=15),
        ModuleLesson(module_id=modules[4].id, title="Correlation strategy", content_ref="lesson:hunt/correlation", lesson_type="reading", order_index=2, estimated_minutes=15),
        ModuleLesson(module_id=modules[5].id, title="Containment checklist", content_ref="lesson:hunt/containment", lesson_type="reading", order_index=1, estimated_minutes=12),
        ModuleLesson(module_id=modules[5].id, title="Recovery timeline", content_ref="lesson:hunt/recovery", lesson_type="exercise", order_index=2, estimated_minutes=18),
    ]
    db.add_all(lessons)
    db.commit()


def seed_rewards(db: Session) -> None:
    if db.query(RewardsCatalog).count() > 0:
        return

    rewards = [
        RewardsCatalog(reward_type="badge", title="First Mission Complete", description="Finish your first mission end-to-end.", icon="badge-first", points=50),
        RewardsCatalog(reward_type="badge", title="Signal Validator", description="Validate 5 threat signals in a row.", icon="badge-signal", points=80),
        RewardsCatalog(reward_type="xp", title="Daily Momentum", description="Complete a daily mission without skipping.", icon="xp-daily", points=30),
        RewardsCatalog(reward_type="streak", title="Week Streak", description="Maintain a 7-day learning streak.", icon="streak-week", points=120),
        RewardsCatalog(reward_type="badge", title="Defense Pathfinder", description="Complete the Defense Foundations path.", icon="badge-defense", points=90),
        RewardsCatalog(reward_type="badge", title="Offense Pathfinder", description="Complete the Offense Foundations path.", icon="badge-offense", points=90),
        RewardsCatalog(reward_type="badge", title="Hunt Operator", description="Complete the Threat Hunting Loop path.", icon="badge-hunt", points=110),
    ]
    db.add_all(rewards)
    db.commit()


def seed_skill_graph(db: Session) -> None:
    if db.query(SkillGraphNode).count() > 0:
        return

    skills = [
        SkillGraphNode(key="osint_intelligence", label="OSINT Intelligence", category="intel", version=1),
        SkillGraphNode(key="web_security", label="Web Security", category="appsec", version=1),
        SkillGraphNode(key="threat_detection", label="Threat Detection", category="defense", version=1),
        SkillGraphNode(key="secure_engineering", label="Secure Engineering", category="defense", version=1),
        SkillGraphNode(key="simulation_ops", label="Simulation Operations", category="labs", version=1),
    ]
    db.add_all(skills)
    db.commit()


def reset_seed_data(db: Session) -> None:
    db.query(ModuleLesson).delete()
    db.query(PathModule).delete()
    db.query(LearningPath).delete()
    db.query(RewardsCatalog).delete()
    db.query(SkillGraphNode).delete()
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed baseline learning paths, rewards, and skills.")
    parser.add_argument("--reset", action="store_true", help="Delete existing seed tables before inserting.")
    parser.add_argument("--paths", action="store_true", help="Seed learning paths, modules, and lessons only.")
    parser.add_argument("--rewards", action="store_true", help="Seed rewards catalog only.")
    parser.add_argument("--skills", action="store_true", help="Seed skill graph only.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.reset:
            reset_seed_data(db)
        if not (args.paths or args.rewards or args.skills):
            seed_learning_paths(db)
            seed_rewards(db)
            seed_skill_graph(db)
            return
        if args.paths:
            seed_learning_paths(db)
        if args.rewards:
            seed_rewards(db)
        if args.skills:
            seed_skill_graph(db)
    finally:
        db.close()


if __name__ == "__main__":
    os.environ.setdefault("PY_SKIP_CREATE_TABLES", "true")
    main()
