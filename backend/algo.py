# #from backend import User


# def distribute(target, user_id, db):
#     user = db.session.query(User).filter_by(id=user_id).first()
#     if not user:
#         return None

#     # Category grouping
#     category_map = {
#         "hat": ["Optional", "Head"],
#         "top": ["Top"],
#         "bot": ["Bottom"],
#         "shoe": ["Shoes"]
#     }

#     # Group user images
#     images_by_cat = {
#         "hat": [],
#         "top": [],
#         "bot": [],
#         "shoe": []
#     }

#     for img in user.images:
#         for group, valid_cats in category_map.items():
#             if img.category in valid_cats:
#                 images_by_cat[group].append(img)

#     # Optional fallback for hat
#     if not images_by_cat["hat"]:
#         images_by_cat["hat"] = [None]

#     # Brute-force all valid combinations (only 1 from each category)
#     best_combo = None
#     best_diff = float('inf')

#     for hat in images_by_cat["hat"]:
#         for top in images_by_cat["top"]:
#             for bot in images_by_cat["bot"]:
#                 for shoe in images_by_cat["shoe"]:
#                     combo = [hat, top, bot, shoe]
#                     total_value = sum(img.value for img in combo if img is not None)
#                     diff = abs(total_value - target)

#                     if diff < best_diff:
#                         best_diff = diff
#                         best_combo = {
#                             "hat": hat,
#                             "top": top,
#                             "bot": bot,
#                             "shoe": shoe
#                         }

#     return best_combo
