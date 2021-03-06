const mongoose = require('mongoose');
const Questao = mongoose.model('Questao');
const User = mongoose.model('User');
const ListaExercicio = mongoose.model('ListaExercicio');
const Rascunho = mongoose.model('Rascunho');
const permissoes = require('../dominio/Permissoes');

// exports.questoes = async (req, res) => {
//   const questoes = await Questao.find({oculta: {$in: [null, false]}});t
//   res.render('questoes', { title: 'Questões', questoes });
// };

exports.getQuestao = async (req, res) => {
  const questaoId = req.params.id;
  let lista = null,
    idProximaQuestao = null,
    idQuestaoAnterior = null;
  if (req.query.lista) {
    lista = await ListaExercicio.findOne({ _id: req.query.lista });
    const questoes = lista.questoes.map(q => q.id);
    const questaoAtualIndex = questoes.indexOf(questaoId);
    if (questaoAtualIndex > 0) {
      idQuestaoAnterior = questoes[questaoAtualIndex - 1];
    }

    if (questaoAtualIndex < questoes.length - 1) {
      idProximaQuestao = questoes[questaoAtualIndex + 1];
    }
  }

  const questao = await Questao.findOne({ _id: questaoId });
  if (questao.oculta && !permissoes.isProfessor(req.user)) {
    req.flash('warning', 'Oops, você não tem permissão de visualizar essa página');
    res.redirect('back');
    return;
  }

  const rascunho = await Rascunho.findOne({ questao, user: req.user });
  const solucao = questao.solucao || null;
  res.render('questao/questao', {
    title: questao.titulo,
    questao,
    solucao,
    listaId: lista ? lista._id : null,
    idQuestaoAnterior,
    idProximaQuestao,
    rascunho
  });
};

exports.adicionarQuestao = async (req, res) => {
  const questaoId = req.params.id || null;
  let questao = null;
  if (questaoId) {
    questao = await Questao.findOne({ _id: questaoId });
    // Remove o _id dos resultados para que o mesmo não apareça no editor de resultados
    for (let i = 0; i < questao.resultados.length; i++) {
      questao.resultados[i]._id = undefined;
    }
  }

  res.render('editarQuestao', {
    title: 'Adicionar Questão',
    dificuldades: Questao.getDificuldades(),
    classificacoes: Questao.getClassificacoes(),
    questao
  });
};

exports.criarQuestao = async (req, res) => {
  req.body = validarQuestaoOculta(req.body);
  const novaQuestao = req.body;
  novaQuestao.resultados = JSON.parse(novaQuestao.resultados);
  const questao = await new Questao(novaQuestao).save();
  req.flash('success', 'Adicionou uma nova questão com sucesso!');
  res.redirect(`/questao/${questao._id}`);
};

exports.atualizarQuestao = async (req, res) => {
  req.body = validarQuestaoOculta(req.body);
  req.body.resultados = JSON.parse(req.body.resultados);
  const questao = await Questao.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // return the new store instead of the old one
    runValidators: true,
    context: 'query'
  }).exec();
  req.flash('success', `Atualizou com sucesso a questão  <strong>${questao.titulo}</strong>.`);
  res.redirect(`/questao/${questao._id}`);
};

exports.favoritarQuestao = async (req, res) => {
  const questoesFavoritas = req.user.questoesFavoritas.map(obj => obj.toString());

  // removes the heart if already exists, otherwise, uses mongodb addToSet to push it and make it unique
  const contemLike = questoesFavoritas.includes(req.params.id);
  const operador = contemLike ? '$pull' : '$addToSet';
  const incremento = contemLike ? -1 : 1;
  try {
    await User.findByIdAndUpdate(req.user._id, { [operador]: { questoesFavoritas: req.params.id } });

    const questao = await Questao.findByIdAndUpdate(req.params.id, { $inc: { likes: incremento } }, { new: true });
    res.json({ likes: questao.likes });
  } catch (err) {
    res.status(500).send(err);
  }
};

/**
 * Por padrão, input(type="checkbox") não retorna nenhum dado caso o atributo checked não esteja
 * marcado, por isso é necessário transformar o valor para false quando o mesmo vier undefined.
 * @param {Object} body - body do request da requisição
 */
function validarQuestaoOculta(body) {
  body.oculta = !!body.oculta;
  return body;
}
