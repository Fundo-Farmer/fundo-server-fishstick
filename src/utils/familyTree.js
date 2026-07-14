/**
 * Builds an ancestor + descendant family tree for a Livestock or Pet document.
 * @param {import('mongoose').Model} Model - Livestock or Pet mongoose model
 * @param {String} id - the subject's _id
 */
const buildFamilyTree = async (Model, id) => {
  const subject = await Model.findById(id).lean();
  if (!subject) return null;

  const lean = (doc) =>
    doc && {
      _id: doc._id,
      name: doc.name,
      gender: doc.gender,
      species: doc.species,
      photos: doc.photos,
      status: doc.status,
      dateOfBirth: doc.dateOfBirth,
    };

  const getAncestors = async (nodeId, depth = 0) => {
    if (!nodeId || depth > 4) return null;
    const node = await Model.findById(nodeId).lean();
    if (!node) return null;
    const [father, mother] = await Promise.all([
      node.parentMale ? getAncestors(node.parentMale, depth + 1) : null,
      node.parentFemale ? getAncestors(node.parentFemale, depth + 1) : null,
    ]);
    return { ...lean(node), father, mother };
  };

  const getDescendants = async (nodeId, depth = 0) => {
    if (depth > 4) return [];
    const children = await Model.find({
      $or: [{ parentMale: nodeId }, { parentFemale: nodeId }],
    }).lean();
    const withChildren = await Promise.all(
      children.map(async (child) => ({
        ...lean(child),
        children: await getDescendants(child._id, depth + 1),
      }))
    );
    return withChildren;
  };

  const [father, mother, children] = await Promise.all([
    subject.parentMale ? getAncestors(subject.parentMale) : null,
    subject.parentFemale ? getAncestors(subject.parentFemale) : null,
    getDescendants(subject._id),
  ]);

  return { ...lean(subject), father, mother, children };
};

module.exports = { buildFamilyTree };
